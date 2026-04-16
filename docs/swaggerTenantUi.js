const buildSwaggerTenantUiScript = (contextPath = "") => `
(function () {
  var STORAGE_KEY = "tableloom.swagger.tenant-config";
  var QUERY_KEYS = {
    tenantId: "tenantId",
    tenantSlug: "tenantSlug",
    tenantKey: "tenantKey",
    workspaceUrl: "workspace",
  };
  var CONTEXT_PATH = ${JSON.stringify(contextPath)};

  function normalizeValue(value) {
    return String(value || "").trim();
  }

  function lowerCaseValue(value) {
    return normalizeValue(value).toLowerCase();
  }

  function readStoredState() {
    try {
      var rawValue = window.localStorage.getItem(STORAGE_KEY);
      return rawValue ? JSON.parse(rawValue) : {};
    } catch (_error) {
      return {};
    }
  }

  function saveState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_error) {}
  }

  function getQueryState() {
    var params = new URLSearchParams(window.location.search);
    return {
      tenantId: normalizeValue(params.get(QUERY_KEYS.tenantId)),
      tenantSlug: lowerCaseValue(params.get(QUERY_KEYS.tenantSlug)),
      tenantKey: lowerCaseValue(params.get(QUERY_KEYS.tenantKey)),
      workspaceUrl: normalizeValue(params.get(QUERY_KEYS.workspaceUrl)),
    };
  }

  function parseWorkspaceUrl(value) {
    var input = normalizeValue(value);
    if (!input) {
      return {
        tenantSlug: "",
        tenantKey: "",
      };
    }

    var pathname = input;

    try {
      pathname = new URL(input, window.location.origin).pathname;
    } catch (_error) {}

    var segments = pathname.split("/").filter(Boolean);

    if (!segments.length) {
      return {
        tenantSlug: "",
        tenantKey: "",
      };
    }

    var stopSegmentIndex = segments.findIndex(function (segment) {
      return ["admin", "table"].includes(String(segment).toLowerCase());
    });

    if (stopSegmentIndex >= 2) {
      return {
        tenantSlug: lowerCaseValue(segments[stopSegmentIndex - 2]),
        tenantKey: lowerCaseValue(segments[stopSegmentIndex - 1]),
      };
    }

    if (
      segments.length >= 2 &&
      !["api", "docs"].includes(String(segments[0]).toLowerCase())
    ) {
      return {
        tenantSlug: lowerCaseValue(segments[0]),
        tenantKey: lowerCaseValue(segments[1]),
      };
    }

    return {
      tenantSlug: "",
      tenantKey: "",
    };
  }

  function getStateFromInputs() {
    var tenantIdInput = document.getElementById("swagger-tenant-id");
    var tenantSlugInput = document.getElementById("swagger-tenant-slug");
    var tenantKeyInput = document.getElementById("swagger-tenant-key");
    var workspaceUrlInput = document.getElementById("swagger-tenant-workspace");

    return {
      tenantId: normalizeValue(tenantIdInput && tenantIdInput.value),
      tenantSlug: lowerCaseValue(tenantSlugInput && tenantSlugInput.value),
      tenantKey: lowerCaseValue(tenantKeyInput && tenantKeyInput.value),
      workspaceUrl: normalizeValue(workspaceUrlInput && workspaceUrlInput.value),
    };
  }

  function mergeStateWithWorkspace(state) {
    var mergedState = Object.assign(
      {
        tenantId: "",
        tenantSlug: "",
        tenantKey: "",
        workspaceUrl: "",
      },
      state || {},
    );

    if (mergedState.workspaceUrl) {
      var parsedWorkspace = parseWorkspaceUrl(mergedState.workspaceUrl);
      if (parsedWorkspace.tenantSlug && parsedWorkspace.tenantKey) {
        if (!mergedState.tenantSlug) {
          mergedState.tenantSlug = parsedWorkspace.tenantSlug;
        }
        if (!mergedState.tenantKey) {
          mergedState.tenantKey = parsedWorkspace.tenantKey;
        }
      }
    }

    return mergedState;
  }

  function getTenantState() {
    var inputState = getStateFromInputs();
    if (
      inputState.tenantId ||
      inputState.tenantSlug ||
      inputState.tenantKey ||
      inputState.workspaceUrl
    ) {
      return mergeStateWithWorkspace(inputState);
    }

    var queryState = getQueryState();
    if (
      queryState.tenantId ||
      queryState.tenantSlug ||
      queryState.tenantKey ||
      queryState.workspaceUrl
    ) {
      return mergeStateWithWorkspace(queryState);
    }

    return mergeStateWithWorkspace(readStoredState());
  }

  function syncQueryString(state) {
    var params = new URLSearchParams(window.location.search);
    var nextState = mergeStateWithWorkspace(state);
    [
      QUERY_KEYS.tenantId,
      QUERY_KEYS.tenantSlug,
      QUERY_KEYS.tenantKey,
      QUERY_KEYS.workspaceUrl,
    ].forEach(function (queryKey) {
      params.delete(queryKey);
    });

    if (nextState.tenantId) {
      params.set(QUERY_KEYS.tenantId, nextState.tenantId);
    }
    if (nextState.tenantSlug) {
      params.set(QUERY_KEYS.tenantSlug, nextState.tenantSlug);
    }
    if (nextState.tenantKey) {
      params.set(QUERY_KEYS.tenantKey, nextState.tenantKey);
    }
    if (nextState.workspaceUrl) {
      params.set(QUERY_KEYS.workspaceUrl, nextState.workspaceUrl);
    }

    var nextQuery = params.toString();
    var nextUrl = window.location.pathname + (nextQuery ? "?" + nextQuery : "");
    window.history.replaceState({}, "", nextUrl);
  }

  function updateStatus(state) {
    var statusNode = document.getElementById("swagger-tenant-status");
    if (!statusNode) {
      return;
    }

    var nextState = mergeStateWithWorkspace(state);

    if (nextState.tenantId) {
      statusNode.textContent =
        "Active tenant header: x-tenant-id = " + nextState.tenantId;
      statusNode.dataset.mode = "ready";
      return;
    }

    if (nextState.tenantSlug && nextState.tenantKey) {
      statusNode.textContent =
        "Active tenant headers: x-tenant-slug = " +
        nextState.tenantSlug +
        ", x-tenant-key = " +
        nextState.tenantKey;
      statusNode.dataset.mode = "ready";
      return;
    }

    statusNode.textContent =
      "No tenant selected. Super admin routes still work, but tenant-scoped routes and tenant admin login need a tenant.";
    statusNode.dataset.mode = "idle";
  }

  function persistToolbarState() {
    var state = mergeStateWithWorkspace(getStateFromInputs());
    saveState(state);
    syncQueryString(state);
    updateStatus(state);

    var tenantSlugInput = document.getElementById("swagger-tenant-slug");
    var tenantKeyInput = document.getElementById("swagger-tenant-key");

    if (tenantSlugInput && state.tenantSlug !== tenantSlugInput.value) {
      tenantSlugInput.value = state.tenantSlug;
    }

    if (tenantKeyInput && state.tenantKey !== tenantKeyInput.value) {
      tenantKeyInput.value = state.tenantKey;
    }
  }

  function writeStateToInputs(state) {
    var nextState = mergeStateWithWorkspace(state);
    var tenantIdInput = document.getElementById("swagger-tenant-id");
    var tenantSlugInput = document.getElementById("swagger-tenant-slug");
    var tenantKeyInput = document.getElementById("swagger-tenant-key");
    var workspaceUrlInput = document.getElementById("swagger-tenant-workspace");

    if (tenantIdInput) {
      tenantIdInput.value = nextState.tenantId || "";
    }
    if (tenantSlugInput) {
      tenantSlugInput.value = nextState.tenantSlug || "";
    }
    if (tenantKeyInput) {
      tenantKeyInput.value = nextState.tenantKey || "";
    }
    if (workspaceUrlInput) {
      workspaceUrlInput.value = nextState.workspaceUrl || "";
    }

    persistToolbarState();
  }

  function clearTenantState() {
    writeStateToInputs({
      tenantId: "",
      tenantSlug: "",
      tenantKey: "",
      workspaceUrl: "",
    });
  }

  function applyTenantHeaders(targetHeaders, state) {
    var headers = Object.assign({}, targetHeaders || {});
    var nextState = mergeStateWithWorkspace(state);

    delete headers["x-tenant-id"];
    delete headers["x-tenant-slug"];
    delete headers["x-tenant-key"];

    if (nextState.tenantId) {
      headers["x-tenant-id"] = nextState.tenantId;
      return headers;
    }

    if (nextState.tenantSlug && nextState.tenantKey) {
      headers["x-tenant-slug"] = nextState.tenantSlug;
      headers["x-tenant-key"] = nextState.tenantKey;
    }

    return headers;
  }

  function installRequestInterceptor() {
    if (!window.ui || typeof window.ui.getConfigs !== "function") {
      return false;
    }

    var configs = window.ui.getConfigs();
    if (configs.__tenantInterceptorInstalled) {
      return true;
    }

    var previousRequestInterceptor =
      typeof configs.requestInterceptor === "function"
        ? configs.requestInterceptor
        : null;

    configs.requestInterceptor = function (request) {
      var state = getTenantState();
      var handleResult = function (result) {
        var nextRequest = result || request;
        nextRequest.headers = applyTenantHeaders(nextRequest.headers, state);
        return nextRequest;
      };

      if (!previousRequestInterceptor) {
        return handleResult(request);
      }

      var interceptedRequest = previousRequestInterceptor(request);

      if (
        interceptedRequest &&
        typeof interceptedRequest.then === "function"
      ) {
        return interceptedRequest.then(handleResult);
      }

      return handleResult(interceptedRequest);
    };

    configs.__tenantInterceptorInstalled = true;
    return true;
  }

  function attachToolbarEvents() {
    var inputIds = [
      "swagger-tenant-id",
      "swagger-tenant-slug",
      "swagger-tenant-key",
      "swagger-tenant-workspace",
    ];

    inputIds.forEach(function (inputId) {
      var element = document.getElementById(inputId);
      if (!element) {
        return;
      }

      element.addEventListener("change", persistToolbarState);
      element.addEventListener("blur", persistToolbarState);
    });

    var applyButton = document.getElementById("swagger-tenant-apply");
    if (applyButton) {
      applyButton.addEventListener("click", function () {
        persistToolbarState();
      });
    }

    var clearButton = document.getElementById("swagger-tenant-clear");
    if (clearButton) {
      clearButton.addEventListener("click", function () {
        clearTenantState();
      });
    }
  }

  function renderToolbar() {
    var topbar = document.querySelector(".swagger-ui .topbar");
    if (!topbar || document.getElementById("swagger-tenant-toolbar")) {
      return false;
    }

    var toolbar = document.createElement("section");
    toolbar.id = "swagger-tenant-toolbar";
    toolbar.className = "swagger-tenant-toolbar";
    toolbar.innerHTML =
      '<div class="swagger-tenant-toolbar__header">' +
      '<div>' +
      '<p class="swagger-tenant-toolbar__eyebrow">Tenant Tester</p>' +
      '<h2>Switch tenant context once, then test normally</h2>' +
      '<p class="swagger-tenant-toolbar__copy">Use tenant ID, slug/key, or paste a workspace URL like /my-restaurant/mykey/admin. These values are saved in your browser and injected into every Swagger request.</p>' +
      '</div>' +
      '<div class="swagger-tenant-toolbar__meta">' +
      '<span>Docs path: ' +
      (CONTEXT_PATH || "/api") +
      '</span>' +
      '<span>Query params supported: tenantId, tenantSlug, tenantKey</span>' +
      '</div>' +
      '</div>' +
      '<div class="swagger-tenant-toolbar__grid">' +
      '<label class="swagger-tenant-toolbar__field">' +
      '<span>Workspace URL</span>' +
      '<input id="swagger-tenant-workspace" type="text" placeholder="/restaurant-slug/tenantkey/admin" />' +
      '</label>' +
      '<label class="swagger-tenant-toolbar__field">' +
      '<span>Tenant ID</span>' +
      '<input id="swagger-tenant-id" type="text" placeholder="Mongo tenant _id" />' +
      '</label>' +
      '<label class="swagger-tenant-toolbar__field">' +
      '<span>Tenant Slug</span>' +
      '<input id="swagger-tenant-slug" type="text" placeholder="restaurant-slug" />' +
      '</label>' +
      '<label class="swagger-tenant-toolbar__field">' +
      '<span>Tenant Key</span>' +
      '<input id="swagger-tenant-key" type="text" placeholder="tenantkey" />' +
      '</label>' +
      '</div>' +
      '<div class="swagger-tenant-toolbar__actions">' +
      '<button id="swagger-tenant-apply" type="button">Apply Tenant</button>' +
      '<button id="swagger-tenant-clear" type="button" class="secondary">Clear</button>' +
      '<p id="swagger-tenant-status" class="swagger-tenant-toolbar__status" data-mode="idle"></p>' +
      '</div>' +
      '<div class="swagger-tenant-toolbar__tips">' +
      '<span>Tenant admin login needs tenant context first.</span>' +
      '<span>For protected tenant routes, Bearer auth still works as usual.</span>' +
      '<span>If both styles are filled, x-tenant-id wins.</span>' +
      '</div>';

    topbar.insertAdjacentElement("afterend", toolbar);
    attachToolbarEvents();
    writeStateToInputs(getTenantState());
    return true;
  }

  function bootstrapSwaggerTenantUi() {
    window.__getSwaggerTenantState = getTenantState;
    window.__applySwaggerTenantHeaders = applyTenantHeaders;
    renderToolbar();
    updateStatus(getTenantState());
    installRequestInterceptor();
  }

  window.addEventListener("load", function () {
    var attemptCount = 0;
    var maxAttempts = 40;
    var bootstrapTimer = window.setInterval(function () {
      attemptCount += 1;
      bootstrapSwaggerTenantUi();

      if (
        document.getElementById("swagger-tenant-toolbar") &&
        installRequestInterceptor()
      ) {
        window.clearInterval(bootstrapTimer);
      }

      if (attemptCount >= maxAttempts) {
        window.clearInterval(bootstrapTimer);
      }
    }, 250);
  });
})();
`;

const swaggerTenantUiStyles = `
.swagger-ui .swagger-tenant-toolbar {
  margin: 0;
  padding: 18px 24px 24px;
  background:
    radial-gradient(circle at top left, rgba(34, 197, 94, 0.18), transparent 28%),
    linear-gradient(135deg, #10211a 0%, #132c22 52%, #0f172a 100%);
  color: #f8fafc;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.swagger-ui .swagger-tenant-toolbar__header {
  display: flex;
  gap: 18px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.swagger-ui .swagger-tenant-toolbar__eyebrow {
  margin: 0 0 8px;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #86efac;
  font-weight: 700;
}

.swagger-ui .swagger-tenant-toolbar h2 {
  margin: 0;
  font-size: 24px;
  line-height: 1.15;
  color: #ffffff;
}

.swagger-ui .swagger-tenant-toolbar__copy {
  max-width: 860px;
  margin: 10px 0 0;
  color: rgba(248, 250, 252, 0.84);
  line-height: 1.5;
}

.swagger-ui .swagger-tenant-toolbar__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 220px;
  padding: 12px 14px;
  background: rgba(15, 23, 42, 0.28);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  font-size: 12px;
  color: rgba(226, 232, 240, 0.92);
}

.swagger-ui .swagger-tenant-toolbar__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.swagger-ui .swagger-tenant-toolbar__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #dcfce7;
}

.swagger-ui .swagger-tenant-toolbar__field input {
  height: 42px;
  width: 100%;
  border: 1px solid rgba(187, 247, 208, 0.18);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.52);
  color: #f8fafc;
  padding: 0 14px;
  outline: none;
  box-shadow: none;
}

.swagger-ui .swagger-tenant-toolbar__field input::placeholder {
  color: rgba(226, 232, 240, 0.5);
}

.swagger-ui .swagger-tenant-toolbar__field input:focus {
  border-color: rgba(134, 239, 172, 0.7);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
}

.swagger-ui .swagger-tenant-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.swagger-ui .swagger-tenant-toolbar__actions button {
  height: 40px;
  border: 0;
  border-radius: 999px;
  padding: 0 18px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  background: #22c55e;
  color: #052e16;
}

.swagger-ui .swagger-tenant-toolbar__actions button.secondary {
  background: rgba(248, 250, 252, 0.1);
  color: #f8fafc;
}

.swagger-ui .swagger-tenant-toolbar__status {
  margin: 0;
  color: rgba(226, 232, 240, 0.88);
  font-size: 13px;
}

.swagger-ui .swagger-tenant-toolbar__status[data-mode="ready"] {
  color: #bbf7d0;
}

.swagger-ui .swagger-tenant-toolbar__tips {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.swagger-ui .swagger-tenant-toolbar__tips span {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.34);
  border: 1px solid rgba(148, 163, 184, 0.14);
  font-size: 12px;
  color: rgba(226, 232, 240, 0.92);
}

@media (max-width: 980px) {
  .swagger-ui .swagger-tenant-toolbar__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .swagger-ui .swagger-tenant-toolbar {
    padding: 16px;
  }

  .swagger-ui .swagger-tenant-toolbar__grid {
    grid-template-columns: 1fr;
  }

  .swagger-ui .swagger-tenant-toolbar h2 {
    font-size: 20px;
  }
}
`;

module.exports = {
  buildSwaggerTenantUiScript,
  swaggerTenantUiStyles,
};
