"use client";

import {
  INFRA_SERVICES,
  AUTH0_METRICS,
  type InfraService,
} from "../lib/super-admin-data";
import type { SystemStatus } from "../lib/api";

/* ── Types for real data ─────────────────────────────────────────── */
export type LiveSubscriber = {
  id: string; name: string; plan: string; status: string;
  active_seats: number; active_clients: number; mrr_gbp: number;
  open_support_tickets: number; joined_date: string | null; contact_email: string;
};

export type LiveRevenueMonth = {
  month: string; mrr_gbp: number; new_mrr: number; churned_mrr: number; expansion_mrr: number;
};

export type LiveKpis = {
  total_orgs: number; total_users: number; total_clients: number;
  total_mrr_gbp: number; open_tickets: number;
};

type DerivedAlert = {
  id: string; severity: "critical" | "warning" | "info";
  title: string; detail: string; tag?: string;
};

/* ── Inline SVG icons ────────────────────────────────────────────── */
function Svg({ children, size = 14 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const IcoGlobe     = () => <Svg><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Svg>;
const IcoServer    = () => <Svg><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></Svg>;
const IcoBell      = () => <Svg><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Svg>;
const IcoTrend     = () => <Svg><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Svg>;
const IcoUsers     = () => <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>;
const IcoCard      = () => <Svg><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></Svg>;
const IcoActivity  = () => <Svg><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Svg>;
const IcoAlert     = () => <Svg><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Svg>;
const IcoCheck     = () => <Svg><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></Svg>;
const IcoX         = () => <Svg><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></Svg>;
const IcoClock     = () => <Svg><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Svg>;
const IcoShield    = () => <Svg><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></Svg>;
const IcoArrowUp   = () => <Svg size={11}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></Svg>;
const IcoArrowDown = () => <Svg size={11}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></Svg>;
const IcoMinus     = () => <Svg size={11}><line x1="5" y1="12" x2="19" y2="12"/></Svg>;

/* ── helpers ─────────────────────────────────────────────────────── */
function fmtGbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function HealthDot({ status }: { status: InfraService["status"] }) {
  const cls: Record<string, string> = {
    healthy: "platDotGreen", degraded: "platDotAmber", down: "platDotRed", unknown: "platDotGrey",
  };
  return <span className={`platDot ${cls[status] ?? "platDotGrey"}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: "Active",    cls: "platBadgeGreen" },
    trial:     { label: "Trial",     cls: "platBadgeBlue" },
    past_due:  { label: "Past due",  cls: "platBadgeRed" },
    suspended: { label: "Suspended", cls: "platBadgeAmber" },
    churned:   { label: "Churned",   cls: "platBadgeGrey" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "platBadgeGrey" };
  return <span className={`platBadge ${cls}`}>{label}</span>;
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    enterprise:   { label: "Enterprise",   cls: "platBadgePurple" },
    professional: { label: "Professional", cls: "platBadgeIndigo" },
    starter:      { label: "Starter",      cls: "platBadgeGrey" },
    trial:        { label: "Trial",        cls: "platBadgeBlue" },
  };
  const { label, cls } = map[plan] ?? { label: plan, cls: "platBadgeGrey" };
  return <span className={`platBadge ${cls}`}>{label}</span>;
}

function AlertIcon({ severity }: { severity: DerivedAlert["severity"] }) {
  if (severity === "critical") return <span className="platAlertIconRed"><IcoX /></span>;
  if (severity === "warning")  return <span className="platAlertIconAmber"><IcoAlert /></span>;
  return <span className="platAlertIconBlue"><IcoBell /></span>;
}

function TrendIcon({ trend }: { trend?: "up" | "down" | "flat" }) {
  if (trend === "up")   return <span className="platTrendUp"><IcoArrowUp /></span>;
  if (trend === "down") return <span className="platTrendDown"><IcoArrowDown /></span>;
  return <span className="platTrendFlat"><IcoMinus /></span>;
}

/* ── KPI card ────────────────────────────────────────────────────── */
function PlatKpi({
  label, value, sub, icon: Icon, accent, urgent,
}: {
  label: string; value: string | number; sub?: string;
  icon: () => React.ReactElement; accent: string; urgent?: boolean;
}) {
  return (
    <div className={`platKpiCard${urgent ? " platKpiCardUrgent" : ""}`} style={{ "--plat-accent": accent } as React.CSSProperties}>
      <div className="platKpiAccent" />
      <div className="platKpiIcon"><Icon /></div>
      <div className="platKpiBody">
        <p className="platKpiLabel">{label}</p>
        <p className="platKpiValue">{value}</p>
        {sub && <p className="platKpiSub">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Revenue sparkline ───────────────────────────────────────────── */
function RevenueChart({ months }: { months: LiveRevenueMonth[] }) {
  if (!months.length) return null;
  const max = Math.max(...months.map((m) => m.mrr_gbp), 1);
  return (
    <div className="platRevenueChart">
      {months.map((m) => {
        const pct = Math.round((m.mrr_gbp / max) * 100);
        const isLast = m.month === months[months.length - 1].month;
        return (
          <div key={m.month} className="platRevenueBar">
            <div
              className={`platRevenueBarFill${isLast ? " platRevenueBarCurrent" : ""}`}
              style={{ height: `${Math.max(pct, 4)}%` }}
              title={`${m.month}: ${fmtGbp(m.mrr_gbp)}`}
            />
            <span className="platRevenueBarLabel">{m.month.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Infra card ──────────────────────────────────────────────────── */
function InfraGrid({ systemStatus }: { systemStatus: SystemStatus | null }) {
  const services = INFRA_SERVICES.map((mock) => {
    const live = systemStatus?.services.find(
      (s) => s.name.toLowerCase().includes(mock.name.split(" ")[0].toLowerCase()) ||
             mock.name.toLowerCase().includes(s.name.toLowerCase().split(" ")[0])
    );
    return live
      ? { ...mock, status: live.status === "ok" ? "healthy" as const : live.status === "degraded" ? "degraded" as const : "down" as const, notes: live.detail !== "Connected" && live.detail !== "OK" ? live.detail : mock.notes }
      : mock;
  });
  const degradedCount = services.filter((s) => s.status !== "healthy").length;
  return (
    <div className="platCard">
      <div className="platCardHeader">
        <IcoServer />
        <h3>Infrastructure health</h3>
        <span className="platCardCount">{degradedCount > 0 ? `${degradedCount} degraded` : "All healthy"}</span>
      </div>
      <div className="platInfraGrid">
        {services.map((svc) => {
          const cap = svc.status.charAt(0).toUpperCase() + svc.status.slice(1);
          return (
            <div key={svc.id} className={`platInfraCard platInfra${cap}`}>
              <div className="platInfraTop">
                <HealthDot status={svc.status} />
                <span className="platInfraName">{svc.name}</span>
              </div>
              <div className="platInfraMeta">
                <span>{svc.uptime99d}% uptime</span>
                <span>{svc.avgResponseMs}ms avg</span>
                <span className="platInfraRegion">{svc.region}</span>
              </div>
              {svc.notes && <p className="platInfraNotes">{svc.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Derive alerts from live data ────────────────────────────────── */
function deriveAlerts(subscribers: LiveSubscriber[], kpis: LiveKpis): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];
  const pastDue = subscribers.filter((s) => s.status === "past_due");
  if (pastDue.length > 0) {
    alerts.push({
      id: "billing-past-due",
      severity: "critical",
      title: `${pastDue.length} past-due account${pastDue.length > 1 ? "s" : ""}`,
      detail: `Clinics with failed billing: ${pastDue.map((s) => s.name).join(", ")}`,
      tag: "Billing",
    });
  }
  if (kpis.open_tickets > 5) {
    alerts.push({
      id: "tickets-high",
      severity: "warning",
      title: `${kpis.open_tickets} open support tickets`,
      detail: "High ticket volume — platform team attention required.",
      tag: "Support",
    });
  }
  const highTicketClinics = subscribers.filter((s) => s.open_support_tickets > 3);
  highTicketClinics.forEach((s) => {
    alerts.push({
      id: `tickets-${s.id}`,
      severity: "info",
      title: `${s.open_support_tickets} tickets from ${s.name}`,
      detail: "This clinic has multiple unresolved support tickets.",
      tag: "Support",
    });
  });
  return alerts;
}

/* ── Main component ──────────────────────────────────────────────── */
export function SuperAdminDashboard({
  name,
  systemStatus,
  kpis,
  subscribers,
  revenueMonths,
}: {
  name: string;
  systemStatus: SystemStatus | null;
  kpis: LiveKpis | null;
  subscribers: LiveSubscriber[];
  revenueMonths: LiveRevenueMonth[];
}) {
  const safeKpis = kpis ?? {
    total_orgs: 0, total_users: 0, total_clients: 0, total_mrr_gbp: 0, open_tickets: 0,
  };

  const activeCount  = subscribers.filter((s) => s.status === "active").length;
  const trialCount   = subscribers.filter((s) => s.status === "trial").length;
  const pastDueCount = subscribers.filter((s) => s.status === "past_due").length;

  const latestRevenue = revenueMonths[revenueMonths.length - 1];
  const prevRevenue   = revenueMonths[revenueMonths.length - 2];
  const mrrChange     = latestRevenue && prevRevenue ? latestRevenue.mrr_gbp - prevRevenue.mrr_gbp : 0;

  const openAlerts = deriveAlerts(subscribers, safeKpis);
  const hasCritical = openAlerts.some((a) => a.severity === "critical");

  return (
    <div className="platShell">
      {/* Header */}
      <div className="platHeader">
        <div>
          <h2 className="platHeaderTitle">Control Plane</h2>
          <p className="platHeaderSub">
            Welcome back, {name.split(" ")[0]} —{" "}
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        {hasCritical && (
          <div className="platHeaderAlert">
            <IcoX />
            {openAlerts.filter((a) => a.severity === "critical").length} critical alert{openAlerts.filter((a) => a.severity === "critical").length !== 1 ? "s" : ""} require attention
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="platKpiGrid">
        <PlatKpi label="Subscriber clinics"      value={safeKpis.total_orgs}    sub={`${activeCount} active · ${trialCount} trial`}                icon={IcoGlobe}    accent="#5b4df2" />
        <PlatKpi label="Monthly recurring revenue" value={fmtGbp(safeKpis.total_mrr_gbp)} sub={`${mrrChange >= 0 ? "+" : ""}${fmtGbp(mrrChange)} vs last month`} icon={IcoCard}    accent="#12a594" />
        <PlatKpi label="Active platform users"   value={safeKpis.total_users}   sub={`Across ${activeCount} active orgs`}                          icon={IcoUsers}    accent="#f59e0b" />
        <PlatKpi label="Total clients"           value={safeKpis.total_clients} sub="All pathways"                                                  icon={IcoShield}   accent="#8b5cf6" />
        <PlatKpi label="Open support tickets"    value={safeKpis.open_tickets}  sub={safeKpis.open_tickets > 0 ? "Requires attention" : "All clear"} icon={IcoActivity} accent="#3b82f6" urgent={safeKpis.open_tickets > 3} />
        <PlatKpi label="Past-due accounts"       value={pastDueCount}           sub={pastDueCount > 0 ? "Requires billing action" : "All accounts current"} icon={IcoAlert} accent="#dc2626" urgent={pastDueCount > 0} />
      </div>

      {/* Main grid */}
      <div className="platGrid">
        <div className="platMain">
          {/* Subscriber table */}
          <div className="platCard">
            <div className="platCardHeader">
              <IcoGlobe />
              <h3>Subscriber clinics</h3>
              <span className="platCardCount">{subscribers.length}</span>
            </div>
            <div className="platTableWrap">
              <table className="platTable">
                <colgroup>
                  <col style={{ width: "24%" }} /><col style={{ width: "12%" }} />
                  <col style={{ width: "9%" }} /><col style={{ width: "9%" }} />
                  <col style={{ width: "10%" }} /><col style={{ width: "10%" }} />
                  <col style={{ width: "8%" }} /><col style={{ width: "9%" }} />
                  <col style={{ width: "9%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Clinic</th><th>Plan</th><th>Status</th>
                    <th style={{ textAlign: "right" }}>MRR</th>
                    <th style={{ textAlign: "right" }}>Users</th>
                    <th style={{ textAlign: "right" }}>Clients</th>
                    <th style={{ textAlign: "right" }}>Tickets</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: "2rem" }}>No subscriber clinics yet.</td></tr>
                  ) : subscribers.map((s) => (
                    <tr key={s.id} className={s.status === "past_due" ? "platRowUrgent" : s.status === "churned" ? "platRowDown" : ""}>
                      <td>
                        <span className="platSubName">{s.name}</span>
                        <span className="platSubMeta">{s.contact_email}</span>
                      </td>
                      <td><PlanBadge plan={s.plan} /></td>
                      <td><StatusBadge status={s.status} /></td>
                      <td className="platNumCell">{fmtGbp(s.mrr_gbp)}</td>
                      <td className="platNumCell">{s.active_seats}</td>
                      <td className="platNumCell">{s.active_clients}</td>
                      <td className="platNumCell">{s.open_support_tickets > 0 ? <span className="platTicketBadge">{s.open_support_tickets}</span> : "—"}</td>
                      <td style={{ fontSize: "0.78rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{s.joined_date ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <InfraGrid systemStatus={systemStatus} />
        </div>

        {/* Right rail */}
        <div className="platRail">
          {/* MRR trend */}
          <div className="platCard">
            <div className="platCardHeader"><IcoTrend /><h3>MRR trend</h3></div>
            <div className="platRevenueSummary">
              <div className="platRevenueCurrent">
                <span className="platRevenueFig">{fmtGbp(latestRevenue?.mrr_gbp ?? 0)}</span>
                <span className={`platRevenueChange ${mrrChange >= 0 ? "platRevenueUp" : "platRevenueDown"}`}>
                  {mrrChange >= 0 ? <IcoArrowUp /> : <IcoArrowDown />}
                  {fmtGbp(Math.abs(mrrChange))} MoM
                </span>
              </div>
              <div className="platRevenueStat">
                <span>New MRR</span><strong>{fmtGbp(latestRevenue?.new_mrr ?? 0)}</strong>
              </div>
              <div className="platRevenueStat">
                <span>Churn</span><strong className="platRevenueDown">−{fmtGbp(latestRevenue?.churned_mrr ?? 0)}</strong>
              </div>
              <div className="platRevenueStat">
                <span>Expansion</span><strong className="platRevenueUp">+{fmtGbp(latestRevenue?.expansion_mrr ?? 0)}</strong>
              </div>
            </div>
            <RevenueChart months={revenueMonths} />
          </div>

          {/* Alerts */}
          <div className="platCard">
            <div className="platCardHeader">
              <IcoBell /><h3>Active alerts</h3>
              {openAlerts.length > 0 && <span className="platCardCountRed">{openAlerts.length}</span>}
            </div>
            <div className="platAlertList">
              {openAlerts.length === 0 ? (
                <div className="platAlertEmpty">
                  <span className="platAlertIconGreen"><IcoCheck /></span>
                  <span>All clear — no active alerts</span>
                </div>
              ) : openAlerts.map((alert) => (
                <div key={alert.id} className={`platAlertItem platAlertItem--${alert.severity}`}>
                  <AlertIcon severity={alert.severity} />
                  <div className="platAlertContent">
                    <p className="platAlertTitle">{alert.title}</p>
                    <p className="platAlertDetail">{alert.detail}</p>
                    {alert.tag && <span className="platAlertTag">{alert.tag}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Auth0 metrics — static reference data */}
          <div className="platCard">
            <div className="platCardHeader"><IcoActivity /><h3>Auth0 tenant</h3></div>
            <div className="platAuth0Grid">
              {AUTH0_METRICS.map((m) => (
                <div key={m.label} className="platAuth0Card">
                  <p className="platAuth0Label">{m.label}</p>
                  <div className="platAuth0Value">
                    <strong>{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</strong>
                    {m.trend && <TrendIcon trend={m.trend} />}
                  </div>
                  {m.trendLabel && <p className="platAuth0Trend">{m.trendLabel}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
