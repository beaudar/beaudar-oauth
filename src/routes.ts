import { settings } from "./app-settings";
import { encodeState, tryDecodeState } from "./state";
import { addCorsHeaders } from "./cors";

const authorizeUrl = "https://github.com/login/oauth/authorize";
const accessTokenUrl = "https://github.com/login/oauth/access_token";

export async function processRequest(fetchEvent: FetchEvent) {
  const response = await routeRequest(fetchEvent);
  applySecurityPolicy(response);
  return response;
}

async function routeRequest(fetchEvent: FetchEvent) {
  const request = fetchEvent.request;
  const { origin, pathname, searchParams: search } = new URL(request.url);

  if (request.method === "OPTIONS") {
    const response = new Response(undefined, { status: 200, statusText: "OK" });
    addCorsHeaders(response, settings.origins, request.headers.get("origin"));
    return response;
  } else if (
    request.method === "GET" &&
    (pathname === "" || pathname === "/")
  ) {
    return new Response("alive", {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/plain" },
    });
  } else if (request.method === "GET" && pathname === "/authorize") {
    return authorizeRequestHandler(origin, search);
  } else if (request.method === "GET" && pathname === "/authorized") {
    return await authorizedRequestHandler(search);
  } else if (request.method === "POST" && pathname === "/token") {
    const response = await tokenRequestHandler(request);
    addCorsHeaders(response, settings.origins, request.headers.get("origin"));
    return response;
  } else if (
    request.method === "POST" &&
    /^\/repos\/[\w-]+\/[\w-.]+\/issues$/i.test(pathname)
  ) {
    const response = await postIssueRequestHandler(
      pathname,
      search,
      fetchEvent
    );
    addCorsHeaders(response, settings.origins, request.headers.get("origin"));
    return response;
  } else {
    return new Response(`Not Found: ${pathname}`, {
      status: 404,
      statusText: "not found",
      headers: { "Content-Type": "text/plain" },
    });
  }
}

function applySecurityPolicy(response: Response) {
  // pages are not allowed to be shown in iframes.
  response.headers.append("X-Frame-Options", "DENY");
  // pages do not have any cross-origin deps on scripts or css.
  response.headers.append("Content-Security-Policy", `default-src 'self'`);
  // don't cache responses.
  response.headers.append(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
}

function badRequest(message: string) {
  return new Response(message, {
    status: 400,
    statusText: "bad request",
    headers: { "Content-Type": "text/plain" },
  });
}

async function authorizeRequestHandler(
  origin: string,
  search: URLSearchParams
) {
  const { client_id, state_password } = settings;

  const appReturnUrl = search.get("redirect_uri");

  if (!appReturnUrl) {
    return badRequest(`"redirect_uri" is required.`);
  }

  const state = await encodeState(appReturnUrl, state_password);
  const redirect_uri = origin + "/authorized";
  return new Response(undefined, {
    status: 302,
    statusText: "found",
    headers: {
      Location: `${authorizeUrl}?${new URLSearchParams({
        client_id,
        redirect_uri,
        state,
      })}`,
    },
  });
}

async function authorizedRequestHandler(search: URLSearchParams) {
  const code = search.get("code");
  const state = search.get("state");

  if (!code) {
    return badRequest('"code" is required.');
  }

  if (!state) {
    return badRequest('"state" is required.');
  }

  const { client_id, client_secret, state_password } = settings;

  const returnUrl = await tryDecodeState(state, state_password);
  if (returnUrl instanceof Error) {
    return badRequest(returnUrl.message);
  }

  const init = {
    method: "POST",
    body: new URLSearchParams({
      client_id,
      client_secret,
      code,
      state,
    }).toString(),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "beaudar",
    },
  };

  let accessToken: string;
  try {
    const response = await fetch(accessTokenUrl, init);
    if (response.ok) {
      const data = await response.json();
      accessToken = data.access_token;
    } else {
      throw new Error(`Access token response had status ${response.status}.`);
    }
  } catch (_) {
    return new Response("Unable to load token from GitHub.");
  }

  const url = new URL(returnUrl);
  const session = await encodeState(
    accessToken,
    state_password,
    Date.now() + 1000 * 60 * 60 * 24 * 365
  );
  url.searchParams.set("beaudar", session);
  return new Response(undefined, {
    status: 302,
    statusText: "found",
    headers: {
      Location: url.href,
    },
  });
}

async function tokenRequestHandler(request: Request) {
  const { state_password } = settings;
  let session: string;
  try {
    session = await request.json();
  } catch {
    return badRequest("Unable to parse body");
  }

  const token = await tryDecodeState(session, state_password);

  if (token instanceof Error) {
    return badRequest(token.message);
  }

  return new Response(JSON.stringify(token), {
    status: 200,
    statusText: "OK",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function postIssueRequestHandler(
  path: string,
  search: URLSearchParams,
  fetchEvent: FetchEvent
) {
  const request = fetchEvent.request;
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return badRequest("Authorization header is required.");
  }

  const authInit = {
    method: "GET",
    headers: {
      Authorization: authorization,
      "User-Agent": "beaudar",
    },
  };

  let authenticated = false;
  try {
    const response = await fetch("https://api.github.com/user", authInit);
    authenticated = response.ok;
  } catch (_) {}
  if (!authenticated) {
    return new Response(undefined, {
      status: 401,
      statusText: "not authorized",
    });
  }

  const init = {
    method: "POST",
    headers: {
      Authorization: "token " + settings.bot_token,
      "User-Agent": "beaudar",
    },
    body: request.body,
  };
  try {
    const response = await fetch(`https://api.github.com${path}`, init);
    const issue = await response.json();
    let labels = search.get("labels");

    if (labels) {
      //   const labelsStr = decodeURIComponent(labels);
      //   labels = JSON.parse(labelsStr);
      //   const labelsInit = {
      //     method: "POST",
      //     headers: {
      //       Authorization: authorization,
      //       "User-Agent": "beaudar",
      //       Accept: "application/vnd.github.symmetra-preview+json",
      //     },
      //     body: JSON.stringify({ labels }),
      //   };
      //   fetchEvent.waitUntil(
      //     fetch(
      //       `https://api.github.com${path}/${issue.number}/labels`,
      //       labelsInit
      //     )
      //   );
    }
    return new Response(JSON.stringify(issue), {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        msg: "Unable to post issue to GitHub.",
        details: error,
      }),
      {
        status: 503,
        statusText: "service unavailable",
        headers: { "Content-Type": "text/plain" },
      }
    );
  }
}
