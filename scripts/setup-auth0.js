#!/usr/bin/env node
/**
 * Neuro Flow — Auth0 tenant bootstrap.
 *
 * Creates (or idempotently updates):
 *   - API resource server  (Neuro Flow API)
 *   - Portal web application  (Neuro Flow Portal)
 *   - Roles  (super-platform-admin, clinical-admin, senior-clinician, clinician)
 *   - Post-Login Action  (injects role / clinic_id / plan claims into tokens)
 *   - Test users  (one per role, plus per-plan clinic accounts)
 *
 * Prerequisites — Auth0 Dashboard:
 *   1. Create a tenant (e.g. neuroflow-dev.eu.auth0.com).
 *   2. Go to Applications → Applications → Create Application.
 *      Name: "Neuro Flow Management"   Type: Machine to Machine.
 *   3. Authorize it for "Auth0 Management API".
 *      For local dev, grant ALL Management API scopes (simplest).
 *      Minimum required: create:users, read:users, update:users,
 *        create:clients, read:clients, update:clients,
 *        create:resource_servers, read:resource_servers,
 *        create:roles, read:roles,
 *        create:actions, update:actions, read:actions,
 *        create:actions_bindings, read:actions_bindings, update:actions_bindings,
 *        read:connections.
 *   4. Copy the Client ID and Client Secret into backend/.env (see below).
 *
 * Usage (from repo root):
 *   node scripts/setup-auth0.js
 *   node scripts/setup-auth0.js --verbose
 *   node scripts/setup-auth0.js --dry-run
 *
 * Required env (backend/.env or shell):
 *   AUTH0_DOMAIN                  your-tenant.eu.auth0.com
 *   AUTH0_MANAGEMENT_CLIENT_ID    M2M client id   (also accepted: AUTH0_MGMT_CLIENT_ID)
 *   AUTH0_MANAGEMENT_CLIENT_SECRET  M2M secret    (also accepted: AUTH0_MGMT_CLIENT_SECRET)
 *
 * Optional env:
 *   AUTH0_AUDIENCE                API audience URL  (default: https://api.neuroflow.app)
 *   AUTH0_DATABASE_CONNECTION     DB connection name (default: Username-Password-Authentication)
 *   NEUROFLOW_HTTPS_ORIGIN        e.g. https://neuroflow.localtest.me:8443
 *   LOCALHTTPS_PORTAL_PORT        default 8443
 */

const https  = require("https");
const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

// ── Env loading ────────────────────────────────────────────────────────────

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  fs.readFileSync(filePath, "utf8")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      let val   = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (val && (!process.env[key] || !String(process.env[key]).trim())) {
        process.env[key] = val;
      }
    });
}

loadEnvFile(path.resolve(__dirname, "../.env"));
loadEnvFile(path.resolve(__dirname, "../backend/.env"));

// ── Config ─────────────────────────────────────────────────────────────────

const VERBOSE = process.argv.includes("--verbose") || process.argv.includes("-v") || process.env.SETUP_AUTH0_VERBOSE === "1";
const DRY_RUN = process.argv.includes("--dry-run");

function normalizeAuth0Domain(raw) {
  return (raw || "").trim().replace(/^https?:\/\//i, "").split("/")[0].trim();
}

const DOMAIN       = normalizeAuth0Domain(process.env.AUTH0_DOMAIN || "");
const MGMT_CLIENT_ID     = process.env.AUTH0_MANAGEMENT_CLIENT_ID || process.env.AUTH0_MGMT_CLIENT_ID || "";
const MGMT_CLIENT_SECRET = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET || process.env.AUTH0_MGMT_CLIENT_SECRET || "";

const API_AUDIENCE = process.env.AUTH0_AUDIENCE || "https://api.neuroflow.app";

const AUTH0_DB_CONNECTION =
  process.env.AUTH0_DATABASE_CONNECTION ||
  process.env.AUTH0_CONNECTION ||
  "Username-Password-Authentication";

const DOMAIN_SUFFIX            = process.env.DOMAIN_SUFFIX || "localtest.me";
const LOCALHTTPS_PORTAL_PORT   = (process.env.LOCALHTTPS_PORTAL_PORT || "8443").trim();

const _portalUrls = [
  ...new Set([
    "http://localhost:3004",
    process.env.NEUROFLOW_HTTPS_ORIGIN,
    process.env.AUTH0_BASE_URL,
    `https://neuroflow.${DOMAIN_SUFFIX}`,
    LOCALHTTPS_PORTAL_PORT && LOCALHTTPS_PORTAL_PORT !== "443"
      ? `https://neuroflow.${DOMAIN_SUFFIX}:${LOCALHTTPS_PORTAL_PORT}`
      : null,
  ].filter(Boolean)),
];

// ── API / Applications / Roles ─────────────────────────────────────────────

const API_NAME   = "Neuro Flow API";
const API_SCOPES = [
  { value: "read:clients",     description: "Read client records" },
  { value: "write:clients",    description: "Create and update client records" },
  { value: "read:assessments", description: "Read assessment data" },
  { value: "write:assessments",description: "Create and update assessments" },
  { value: "read:reports",     description: "Read clinical reports" },
  { value: "write:reports",    description: "Create and submit clinical reports" },
  { value: "read:team",        description: "Read team and clinician data" },
  { value: "admin:platform",   description: "Platform-level operator access" },
];

const APPLICATIONS = [
  {
    name: "Neuro Flow Portal",
    type: "regular_web",
    callbacks:            _portalUrls.map((u) => `${u}/api/auth/callback`),
    allowed_logout_urls:  _portalUrls,
    allowed_origins:      _portalUrls,
    web_origins:          _portalUrls,
  },
];

const ROLES = [
  { name: "super-platform-admin", description: "Neuro Flow platform operator — cross-tenant admin" },
  { name: "clinical-admin",       description: "Clinic administrator — intake, scheduling, team, finance" },
  { name: "senior-clinician",     description: "Senior clinician — sign-off authority, report review" },
  { name: "clinician",            description: "Clinician — assigned caseloads and assessments" },
];

// ── Post-Login Action ──────────────────────────────────────────────────────

const POST_LOGIN_ACTION_NAME = "Add Neuro Flow Claims";
const POST_LOGIN_ACTION_CODE = `
exports.onExecutePostLogin = async (event, api) => {
  const aud = '${API_AUDIENCE.replace(/'/g, "\\'")}';

  const email = event.user.email;
  if (email) {
    api.idToken.setCustomClaim(aud + '/email', email);
    api.accessToken.setCustomClaim(aud + '/email', email);
  }

  const explicitRole = event.user.app_metadata?.role;
  if (explicitRole) {
    api.idToken.setCustomClaim(aud + '/role', explicitRole);
    api.accessToken.setCustomClaim(aud + '/role', explicitRole);
  }

  const appRoles = event.user.app_metadata?.roles;
  const hasAppRoles = Array.isArray(appRoles) && appRoles.length > 0;
  if (hasAppRoles && !explicitRole) {
    const primary = appRoles[0];
    api.idToken.setCustomClaim(aud + '/role', primary);
    api.accessToken.setCustomClaim(aud + '/role', primary);
  }

  const platformScope = event.user.app_metadata?.platform_scope;
  if (platformScope) {
    api.idToken.setCustomClaim(aud + '/platform_scope', platformScope);
    api.accessToken.setCustomClaim(aud + '/platform_scope', platformScope);
  }

  const clinicId = event.user.app_metadata?.clinic_id;
  if (clinicId) {
    api.idToken.setCustomClaim(aud + '/clinic_id', clinicId);
    api.accessToken.setCustomClaim(aud + '/clinic_id', clinicId);
  }

  const clinicName = event.user.app_metadata?.clinic_name;
  if (clinicName) {
    api.idToken.setCustomClaim(aud + '/clinic_name', clinicName);
    api.accessToken.setCustomClaim(aud + '/clinic_name', clinicName);
  }

  const subscriptionPlan = event.user.app_metadata?.subscription_plan;
  if (subscriptionPlan) {
    api.idToken.setCustomClaim(aud + '/subscription_plan', subscriptionPlan);
    api.accessToken.setCustomClaim(aud + '/subscription_plan', subscriptionPlan);
  }

  const auth0Roles = event.authorization?.roles || [];
  if (auth0Roles.length > 0 && !hasAppRoles && !explicitRole) {
    api.idToken.setCustomClaim(aud + '/role', auth0Roles[0]);
    api.accessToken.setCustomClaim(aud + '/role', auth0Roles[0]);
  }
};
`;

// ── Test users ─────────────────────────────────────────────────────────────

/** Shared password for all test accounts — change before any non-local environment. */
const TEST_PASSWORD = "NeuroFlowTest01!";

const PLATFORM_ADMIN_USER = {
  email: "platform@neuroflow.test",
  password: TEST_PASSWORD,
  name: "Neuro Flow Platform Admin",
  role: "super-platform-admin",
  app_metadata: {
    role: "super-platform-admin",
    roles: ["super-platform-admin"],
    platform_scope: "global",
  },
};

/** One seed clinic per subscription plan — IDs match backend/app/seed.py. */
const SEED_CLINICS = [
  { plan: "starter",      clinicName: "Starter Test Clinic",      clinicId: "CLINIC-STARTER" },
  { plan: "professional", clinicName: "Professional Test Clinic",  clinicId: "CLINIC-PRO"     },
  { plan: "enterprise",   clinicName: "Enterprise Test Clinic",    clinicId: "CLINIC-ENT"     },
];

const PLAN_USER_TYPES = [
  {
    key:  "admin",
    name: "Clinical Admin",
    role: "clinical-admin",
    metadata: ({ clinicId, clinicName, plan }) => ({
      roles: ["clinical-admin"],
      clinic_id: clinicId,
      clinic_name: clinicName,
      subscription_plan: plan,
    }),
  },
  {
    key:  "senior",
    name: "Senior Clinician",
    role: "senior-clinician",
    metadata: ({ clinicId, clinicName, plan }) => ({
      roles: ["senior-clinician"],
      clinic_id: clinicId,
      clinic_name: clinicName,
      subscription_plan: plan,
    }),
  },
  {
    key:  "clinician",
    name: "Clinician",
    role: "clinician",
    metadata: ({ clinicId, clinicName, plan }) => ({
      roles: ["clinician"],
      clinic_id: clinicId,
      clinic_name: clinicName,
      subscription_plan: plan,
    }),
  },
];

const PLAN_TEST_USERS = SEED_CLINICS.flatMap((clinic) =>
  PLAN_USER_TYPES.map((ut) => ({
    email:        `${clinic.plan}.${ut.key}@neuroflow.test`,
    password:     TEST_PASSWORD,
    name:         `${clinic.clinicName} ${ut.name}`,
    role:         ut.role,
    app_metadata: ut.metadata(clinic),
  }))
);

/** Named users that match backend/app/seed.py. */
const NAMED_TEST_USERS = [
  {
    email: "superadmin@neuroflow.test",
    password: TEST_PASSWORD,
    name: "Alex Thornton",
    role: "super-platform-admin",
    app_metadata: { role: "super-platform-admin", roles: ["super-platform-admin"], platform_scope: "global" },
  },
  {
    email: "clinicaladmin@neuroflow.test",
    password: TEST_PASSWORD,
    name: "Sarah Mitchell",
    role: "clinical-admin",
    app_metadata: { role: "clinical-admin", roles: ["clinical-admin"], clinic_id: "CLINIC-001", clinic_name: "Demo Clinic" },
  },
  {
    email: "seniorclinician@neuroflow.test",
    password: TEST_PASSWORD,
    name: "Dr James Okafor",
    role: "senior-clinician",
    app_metadata: { role: "senior-clinician", roles: ["senior-clinician"], clinic_id: "CLINIC-001", clinic_name: "Demo Clinic" },
  },
  {
    email: "clinician@neuroflow.test",
    password: TEST_PASSWORD,
    name: "Dr Maya Patel",
    role: "clinician",
    app_metadata: { role: "clinician", roles: ["clinician"], clinic_id: "CLINIC-001", clinic_name: "Demo Clinic" },
  },
];

const ALL_TEST_USERS = [PLATFORM_ADMIN_USER, ...NAMED_TEST_USERS, ...PLAN_TEST_USERS];

// ── HTTP helper ────────────────────────────────────────────────────────────

function request(method, path_, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: DOMAIN,
      port: 443,
      path: path_,
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    };
    if (token) options.headers.Authorization = `Bearer ${token}`;

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const code    = res.statusCode || 0;
        const trimmed = (data || "").trim();

        if ((code === 204 || trimmed === "") && code >= 200 && code < 300) {
          resolve({});
          return;
        }

        let parsed;
        try {
          parsed = trimmed ? JSON.parse(trimmed) : null;
        } catch {
          const err = new Error(`HTTP ${code}: non-JSON from ${path_.slice(0, 80)} — ${trimmed.slice(0, 400)}`);
          if (VERBOSE) console.error("[verbose]", err.message);
          reject(err);
          return;
        }

        if (code >= 200 && code < 300) {
          resolve(parsed ?? {});
        } else {
          const msg = (parsed && (parsed.message || parsed.error || parsed.error_description)) || trimmed;
          const err = new Error(`HTTP ${code}: ${msg}`);
          if (VERBOSE) console.error("[verbose]", path_, code, trimmed.slice(0, 1200));
          reject(err);
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function asArray(body) {
  if (!body) return [];
  if (Array.isArray(body)) return body;
  for (const key of ["clients", "roles", "resource_servers", "actions", "connections"]) {
    if (Array.isArray(body[key])) return body[key];
  }
  return [];
}

async function getMgmtToken() {
  const resp = await request("POST", "/oauth/token", {
    grant_type:    "client_credentials",
    client_id:     MGMT_CLIENT_ID,
    client_secret: MGMT_CLIENT_SECRET,
    audience:      `https://${DOMAIN}/api/v2/`,
  });
  return resp.access_token;
}

function mgmt(token) {
  return {
    get:   (p)       => request("GET",   `/api/v2${p}`,  null, token),
    post:  (p, body) => request("POST",  `/api/v2${p}`,  body, token),
    patch: (p, body) => request("PATCH", `/api/v2${p}`,  body, token),
  };
}

function die(msg) {
  console.error("\n❌ " + msg);
  process.exit(1);
}

function checkEnv() {
  if (!DOMAIN)             die("AUTH0_DOMAIN is required (e.g. your-tenant.eu.auth0.com)");
  if (!MGMT_CLIENT_ID)     die("AUTH0_MANAGEMENT_CLIENT_ID is required (the M2M app client ID)");
  if (!MGMT_CLIENT_SECRET) die("AUTH0_MANAGEMENT_CLIENT_SECRET is required");
}

// ── Provisioning steps ─────────────────────────────────────────────────────

async function getOrCreateApi(api) {
  console.log("🔍 API resource server...");
  const servers = asArray(await api.get("/resource-servers"));
  let rs = servers.find((s) => s.identifier === API_AUDIENCE);
  if (rs) {
    console.log(`   ✅ ${rs.name} (${rs.id})`);
    return rs;
  }
  rs = await api.post("/resource-servers", {
    name:                 API_NAME,
    identifier:           API_AUDIENCE,
    signing_alg:          "RS256",
    token_lifetime:       86400,
    allow_offline_access: true,
    scopes:               API_SCOPES,
  });
  console.log(`   ✅ Created API: ${rs.name}`);
  return rs;
}

async function getOrCreateApplications(api) {
  console.log("🔍 Applications...");
  const clients = asArray(await api.get("/clients?per_page=100"));
  const results = [];
  for (const appConfig of APPLICATIONS) {
    let client = clients.find((c) => c.name === appConfig.name);
    const payload = {
      name:                 appConfig.name,
      app_type:             appConfig.type,
      callbacks:            appConfig.callbacks,
      allowed_logout_urls:  appConfig.allowed_logout_urls,
      allowed_origins:      appConfig.allowed_origins,
      web_origins:          appConfig.web_origins,
      grant_types:          ["authorization_code", "implicit", "refresh_token", "client_credentials"],
      jwt_configuration:    { alg: "RS256" },
    };
    if (client) {
      await api.patch(`/clients/${encodeURIComponent(client.client_id)}`, payload);
      console.log(`   ✅ ${client.name} (updated callback URLs)`);
    } else {
      client = await api.post("/clients", payload);
      console.log(`   ✅ Created: ${client.name}`);
    }
    results.push({ ...appConfig, clientId: client.client_id, clientSecret: client.client_secret });
  }
  return results;
}

async function getOrCreateRoles(api) {
  console.log("🔍 Roles...");
  const existing = asArray(await api.get("/roles"));
  const results  = [];
  for (const roleDef of ROLES) {
    let role = existing.find((r) => r.name === roleDef.name);
    if (!role) {
      role = await api.post("/roles", roleDef);
      console.log(`   ✅ Created role: ${role.name}`);
    } else {
      console.log(`   ✅ Role: ${role.name}`);
    }
    results.push(role);
  }
  return results;
}

async function getOrCreatePostLoginAction(api) {
  console.log("🔍 Post-login action...");
  const token      = await getMgmtToken();
  const actionsResp = await request("GET", `/api/v2/actions/actions?triggerId=post-login`, null, token);
  const actions     = asArray(actionsResp);
  let action        = actions.find((a) => a.name === POST_LOGIN_ACTION_NAME);

  const actionPayload = {
    code:               POST_LOGIN_ACTION_CODE,
    runtime:            "node18-actions",
    supported_triggers: [{ id: "post-login", version: "v3" }],
  };

  if (action) {
    await request("PATCH", `/api/v2/actions/actions/${action.id}`, actionPayload, token);
    console.log("   🔄 Action updated");
  } else {
    action = await request("POST", "/api/v2/actions/actions", { name: POST_LOGIN_ACTION_NAME, ...actionPayload }, token);
    console.log("   ✅ Action created");
  }

  // Wait for build
  let built = false;
  for (let i = 0; i < 15; i++) {
    const status = await request("GET", `/api/v2/actions/actions/${action.id}`, null, token);
    if (status.status === "built") { built = true; break; }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (built) {
    await request("POST", `/api/v2/actions/actions/${action.id}/deploy`, {}, token);
    console.log("   ✅ Action deployed");
  } else {
    console.log("   ⚠️  Action still building — deploy manually in Auth0 Dashboard → Actions → Library.");
  }

  // Bind to login flow
  const bindingsResp = await request("GET", `/api/v2/actions/triggers/post-login/bindings`, null, token);
  const bindings      = bindingsResp.bindings || [];
  const alreadyBound  = bindings.some((b) => b.action?.id === action.id);
  if (!alreadyBound) {
    const existing = bindings.map((b) => ({
      display_name: b.display_name,
      ref: { type: "action_id", value: b.action?.id || b.ref?.value },
    }));
    await request("PATCH", `/api/v2/actions/triggers/post-login/bindings`, {
      bindings: [...existing, { display_name: POST_LOGIN_ACTION_NAME, ref: { type: "action_id", value: action.id } }],
    }, token);
    console.log("   ✅ Action bound to post-login flow");
  } else {
    console.log("   ✅ Action already bound");
  }
}

function scrubAppMetadata(meta) {
  if (!meta || typeof meta !== "object") return meta;
  const out = { ...meta };
  for (const k of Object.keys(out)) {
    if (out[k] === null || out[k] === undefined) delete out[k];
  }
  return out;
}

async function printDatabaseConnectionHint(api) {
  try {
    const all = asArray(await api.get("/connections?per_page=100"));
    const db  = all.filter((c) => c.strategy === "auth0");
    if (!db.length) {
      console.log("   ⚠️  No database connections found. Add one in Auth0 → Authentication → Database.");
      return;
    }
    console.log(`   Tenant DB connection(s): ${db.map((c) => c.name).join(", ")}`);
    const ok = db.some((c) => c.name === AUTH0_DB_CONNECTION);
    if (!ok) {
      console.warn(
        `   ⚠️  AUTH0_DATABASE_CONNECTION="${AUTH0_DB_CONNECTION}" not found. ` +
        `Set it in backend/.env to match one of the names above.`
      );
    } else {
      console.log(`   ✅ Connection "${AUTH0_DB_CONNECTION}" confirmed`);
    }
  } catch (e) {
    console.warn(`   ⚠️  Could not list connections: ${e.message}`);
    console.warn(`      Add read:connections to M2M scopes, or set AUTH0_DATABASE_CONNECTION manually.`);
  }
}

async function createTestUsers(api, roles) {
  console.log("🔍 Test users...");
  console.log(`   Connection: ${AUTH0_DB_CONNECTION}`);
  await printDatabaseConnectionHint(api);

  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r.id]));

  for (const userDef of ALL_TEST_USERS) {
    const existing = asArray(await api.get(`/users-by-email?email=${encodeURIComponent(userDef.email)}`));
    const meta     = scrubAppMetadata(userDef.app_metadata);
    let user;

    if (existing.length > 0) {
      user = existing[0];
      await api.patch(`/users/${encodeURIComponent(user.user_id)}`, {
        connection:   AUTH0_DB_CONNECTION,
        password:     userDef.password,
        app_metadata: meta,
      });
      console.log(`   🔄 ${userDef.email} (updated)`);
    } else {
      try {
        user = await api.post("/users", {
          connection:     AUTH0_DB_CONNECTION,
          email:          userDef.email,
          password:       userDef.password,
          name:           userDef.name,
          email_verified: true,
          app_metadata:   meta,
        });
        if (!user?.user_id) throw new Error("Create returned no user_id. Re-run with --verbose.");
        console.log(`   ✅ ${userDef.email} (created)`);
      } catch (err) {
        console.error(
          `\n❌ Failed to create ${userDef.email}: ${err.message || err}\n` +
          `   Check: M2M scopes include create:users; connection "${AUTH0_DB_CONNECTION}" exists;\n` +
          `   password meets your tenant policy. Run with --verbose for full detail.\n`
        );
        throw err;
      }
    }

    const roleId = roleMap[userDef.role];
    if (roleId) {
      try {
        await api.post(`/users/${encodeURIComponent(user.user_id)}/roles`, { roles: [roleId] });
      } catch (err) {
        console.warn(`   ⚠️  Could not assign role "${userDef.role}" to ${userDef.email}: ${err.message || err}`);
      }
    }
  }
}

// ── Summary output ─────────────────────────────────────────────────────────

function printEnvBlock(apps, domain) {
  const portal = apps.find((a) => a.name === "Neuro Flow Portal");

  const suggestedBase =
    process.env.NEUROFLOW_HTTPS_ORIGIN?.trim() ||
    process.env.AUTH0_BASE_URL?.trim()         ||
    "http://localhost:3004";

  console.log("\n" + "=".repeat(70));
  console.log("📋 COPY INTO ENV FILES");
  console.log("=".repeat(70));

  console.log("\n# ── backend/.env ────────────────────────────────────────────");
  console.log(`AUTH0_DOMAIN=${domain}`);
  console.log(`AUTH0_AUDIENCE=${API_AUDIENCE}`);
  console.log(`AUTH0_CLIENT_ID=${portal?.clientId || ""}`);
  console.log(`AUTH0_CLIENT_SECRET=${portal?.clientSecret || ""}`);
  console.log(`AUTH0_MANAGEMENT_CLIENT_ID=${MGMT_CLIENT_ID}`);
  console.log(`AUTH0_MANAGEMENT_CLIENT_SECRET=${MGMT_CLIENT_SECRET}`);
  console.log(`AUTH0_VALIDATE_JWT=true`);

  console.log("\n# ── frontend/.env.local ─────────────────────────────────────");
  console.log(`AUTH0_SECRET=${crypto.randomBytes(32).toString("hex")}`);
  console.log(`AUTH0_ISSUER_BASE_URL=https://${domain}`);
  console.log(`AUTH0_BASE_URL=${suggestedBase}`);
  console.log(`AUTH0_CLIENT_ID=${portal?.clientId || ""}`);
  console.log(`AUTH0_CLIENT_SECRET=${portal?.clientSecret || ""}`);
  console.log(`AUTH0_AUDIENCE=${API_AUDIENCE}`);
  console.log(`NEXT_PUBLIC_API_URL=http://localhost:8004`);
  console.log(`BACKEND_URL=http://127.0.0.1:8004`);

  console.log(`
# IMPORTANT: AUTH0_BASE_URL must match the exact URL you open in the browser
# (scheme + host + port). If you use https://neuroflow.localtest.me:8443,
# AUTH0_BASE_URL must be that value — not http://localhost:3004.
# Mismatch causes: Missing state cookie / ERR_CALLBACK_HANDLER_FAILURE.
# Re-run this script after changing NEUROFLOW_HTTPS_ORIGIN or AUTH0_BASE_URL.`);

  console.log("\n" + "=".repeat(70));
  console.log("🔑 Test password for all accounts: " + TEST_PASSWORD);
  console.log("=".repeat(70));
  console.log("\n Platform / super admin:");
  console.log(`   ${PLATFORM_ADMIN_USER.email}  (${PLATFORM_ADMIN_USER.role})`);
  console.log("\n Named test accounts (match backend/app/seed.py):");
  for (const u of NAMED_TEST_USERS) {
    console.log(`   ${u.email}  (${u.role})`);
  }
  console.log("\n Per-plan clinic accounts:");
  for (const u of PLAN_TEST_USERS) {
    const plan = u.app_metadata.subscription_plan;
    console.log(`   ${u.email}  (${u.role}, plan: ${plan})`);
  }
  console.log("=".repeat(70) + "\n");
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Neuro Flow — Auth0 tenant bootstrap\n");

  checkEnv();

  if (VERBOSE) console.log("[verbose] Auth0 domain:", DOMAIN);
  if (VERBOSE) console.log("[verbose] API audience:", API_AUDIENCE);
  if (VERBOSE) console.log("[verbose] Portal callback URLs:", _portalUrls.map((u) => `${u}/api/auth/callback`).join(", "));

  if (DRY_RUN) {
    console.log("── Dry run — nothing will be created ──");
    console.log("Domain    :", DOMAIN);
    console.log("Audience  :", API_AUDIENCE);
    console.log("Portal URLs:", _portalUrls.join(", "));
    console.log("Roles     :", ROLES.map((r) => r.name).join(", "));
    console.log("Users     :", ALL_TEST_USERS.map((u) => u.email).join(", "));
    return;
  }

  const token = await getMgmtToken();
  const api   = mgmt(token);

  try {
    await getOrCreateApi(api);
    const apps  = await getOrCreateApplications(api);
    const roles = await getOrCreateRoles(api);
    await createTestUsers(api, roles);
    await getOrCreatePostLoginAction(api);
    console.log("\n🎉 Done.");
    printEnvBlock(apps, DOMAIN);
  } catch (err) {
    console.error("\n❌", err.message || err);
    process.exit(1);
  }
}

main();
