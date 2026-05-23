"use client";

import {
  SUBSCRIBERS,
  INFRA_SERVICES,
  REVENUE_MONTHS,
  PLATFORM_ALERTS,
  AUTH0_METRICS,
  platformKpis,
  type Subscriber,
  type InfraService,
  type PlatformAlert,
} from "../lib/super-admin-data";
import type { SystemStatus } from "../lib/api";

/* ── Inline SVG icons (no lucide-react dependency) ───────────────── */
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
    healthy:  "platDotGreen",
    degraded: "platDotAmber",
    down:     "platDotRed",
    unknown:  "platDotGrey",
  };
  return <span className={`platDot ${cls[status] ?? "platDotGrey"}`} />;
}

function StatusBadge({ status }: { status: Subscriber["status"] }) {
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

function PlanBadge({ plan }: { plan: Subscriber["plan"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    enterprise:   { label: "Enterprise",   cls: "platBadgePurple" },
    professional: { label: "Professional", cls: "platBadgeIndigo" },
    starter:      { label: "Starter",      cls: "platBadgeGrey" },
    trial:        { label: "Trial",        cls: "platBadgeBlue" },
  };
  const { label, cls } = map[plan] ?? { label: plan, cls: "platBadgeGrey" };
  return <span className={`platBadge ${cls}`}>{label}</span>;
}

function AlertIcon({ severity }: { severity: PlatformAlert["severity"] }) {
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
function RevenueChart() {
  const max = Math.max(...REVENUE_MONTHS.map((m) => m.mrrGbp));
  return (
    <div className="platRevenueChart">
      {REVENUE_MONTHS.map((m) => {
        const pct = Math.round((m.mrrGbp / max) * 100);
        const isLast = m.month === REVENUE_MONTHS[REVENUE_MONTHS.length - 1].month;
        return (
          <div key={m.month} className="platRevenueBar">
            <div
              className={`platRevenueBarFill${isLast ? " platRevenueBarCurrent" : ""}`}
              style={{ height: `${pct}%` }}
              title={`${m.month}: ${fmtGbp(m.mrrGbp)}`}
            />
            <span className="platRevenueBarLabel">{m.month.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Infra card — merges real backend status with mock metrics ────── */
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

/* ── Main component ──────────────────────────────────────────────── */
export function SuperAdminDashboard({ name, systemStatus }: { name: string; systemStatus: SystemStatus | null }) {
  const kpis = platformKpis;
  const openAlerts = PLATFORM_ALERTS.filter((a) => !a.resolved);
  const latestRevenue = REVENUE_MONTHS[REVENUE_MONTHS.length - 1];
  const prevRevenue   = REVENUE_MONTHS[REVENUE_MONTHS.length - 2];
  const mrrChange     = latestRevenue.mrrGbp - prevRevenue.mrrGbp;

  const liveUptime = systemStatus ? `${Math.round(systemStatus.uptime_seconds / 3600)}h` : `${kpis.systemUptime}%`;

  return (
    <div className="platShell">
      {/* ── Header ── */}
      <div className="platHeader">
        <div>
          <h2 className="platHeaderTitle">Control Plane</h2>
          <p className="platHeaderSub">
            Welcome back, {name.split(" ")[0]} — {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        {openAlerts.some((a) => a.severity === "critical") && (
          <div className="platHeaderAlert">
            <IcoX />
            {openAlerts.filter((a) => a.severity === "critical").length} critical alert{openAlerts.filter((a) => a.severity === "critical").length !== 1 ? "s" : ""} require attention
          </div>
        )}
      </div>

      {/* ── KPI row ── */}
      <div className="platKpiGrid">
        <PlatKpi label="Subscriber clinics" value={kpis.totalOrgs} sub={`${kpis.activeOrgs} active · ${kpis.trialOrgs} trial`} icon={IcoGlobe} accent="#5b4df2" />
        <PlatKpi label="Monthly recurring revenue" value={fmtGbp(kpis.totalMrrGbp)} sub={`${mrrChange >= 0 ? "+" : ""}${fmtGbp(mrrChange)} vs last month`} icon={IcoCard} accent="#12a594" />
        <PlatKpi label="Total licensed seats" value={kpis.totalSeats.toLocaleString()} sub={`${kpis.activeOrgs} orgs enrolled`} icon={IcoUsers} accent="#f59e0b" />
        <PlatKpi label="System uptime" value={systemStatus ? liveUptime : `${kpis.systemUptime}%`} sub={`${kpis.openAlerts} open alert${kpis.openAlerts !== 1 ? "s" : ""}`} icon={IcoActivity} accent="#3b82f6" urgent={kpis.openAlerts > 0} />
        <PlatKpi label="Reports this month" value={kpis.totalReportsThisMonth.toLocaleString()} sub="Across all tenants" icon={IcoShield} accent="#8b5cf6" />
        <PlatKpi label="Past-due accounts" value={kpis.pastDueOrgs} sub={kpis.pastDueOrgs > 0 ? "Requires billing action" : "All accounts current"} icon={IcoAlert} accent="#dc2626" urgent={kpis.pastDueOrgs > 0} />
      </div>

      {/* ── Main grid ── */}
      <div className="platGrid">
        {/* ── Left: subscriber table + infra ── */}
        <div className="platMain">

          {/* Subscriber accounts */}
          <div className="platCard">
            <div className="platCardHeader">
              <IcoGlobe />
              <h3>Subscriber clinics</h3>
              <span className="platCardCount">{SUBSCRIBERS.length}</span>
            </div>
            <div className="platTableWrap">
              <table className="platTable">
                <colgroup>
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "9%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Clinic</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Health</th>
                    <th style={{ textAlign: "right" }}>MRR</th>
                    <th style={{ textAlign: "right" }}>Seats</th>
                    <th style={{ textAlign: "right" }}>Tickets</th>
                    <th style={{ textAlign: "right" }}>Reports</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBSCRIBERS.map((s) => (
                    <tr key={s.id} className={s.status === "past_due" ? "platRowUrgent" : s.health === "down" ? "platRowDown" : ""}>
                      <td>
                        <span className="platSubName">{s.name}</span>
                        <span className="platSubMeta">{s.country} · {s.industry}</span>
                      </td>
                      <td><PlanBadge plan={s.plan} /></td>
                      <td><StatusBadge status={s.status} /></td>
                      <td>
                        <div className="platHealthCell">
                          <HealthDot status={s.health} />
                          <span>{s.health}</span>
                        </div>
                      </td>
                      <td className="platNumCell">{fmtGbp(s.mrrGbp)}</td>
                      <td className="platNumCell">{s.activeSeats}/{s.seats}</td>
                      <td className="platNumCell">{s.openSupportTickets > 0 ? <span className="platTicketBadge">{s.openSupportTickets}</span> : "—"}</td>
                      <td className="platNumCell">{s.reportsThisMonth.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Infrastructure health */}
          <InfraGrid systemStatus={systemStatus} />
        </div>

        {/* ── Right rail ── */}
        <div className="platRail">

          {/* MRR trend */}
          <div className="platCard">
            <div className="platCardHeader">
              <IcoTrend />
              <h3>MRR trend</h3>
            </div>
            <div className="platRevenueSummary">
              <div className="platRevenueCurrent">
                <span className="platRevenueFig">{fmtGbp(latestRevenue.mrrGbp)}</span>
                <span className={`platRevenueChange ${mrrChange >= 0 ? "platRevenueUp" : "platRevenueDown"}`}>
                  {mrrChange >= 0 ? <IcoArrowUp /> : <IcoArrowDown />}
                  {fmtGbp(Math.abs(mrrChange))} MoM
                </span>
              </div>
              <div className="platRevenueStat">
                <span>New MRR</span><strong>{fmtGbp(latestRevenue.newMrr)}</strong>
              </div>
              <div className="platRevenueStat">
                <span>Churn</span><strong className="platRevenueDown">−{fmtGbp(latestRevenue.churnedMrr)}</strong>
              </div>
              <div className="platRevenueStat">
                <span>Expansion</span><strong className="platRevenueUp">+{fmtGbp(latestRevenue.expansionMrr)}</strong>
              </div>
            </div>
            <RevenueChart />
          </div>

          {/* Alerts */}
          <div className="platCard">
            <div className="platCardHeader">
              <IcoBell />
              <h3>Active alerts</h3>
              {openAlerts.length > 0 && <span className="platCardCountRed">{openAlerts.length}</span>}
            </div>
            <div className="platAlertList">
              {openAlerts.length === 0 ? (
                <div className="platAlertEmpty">
                  <span className="platAlertIconGreen"><IcoCheck /></span>
                  <span>All clear — no active alerts</span>
                </div>
              ) : (
                openAlerts.map((alert) => (
                  <div key={alert.id} className={`platAlertItem platAlertItem--${alert.severity}`}>
                    <AlertIcon severity={alert.severity} />
                    <div className="platAlertContent">
                      <p className="platAlertTitle">{alert.title}</p>
                      <p className="platAlertDetail">{alert.detail}</p>
                      {alert.service && <span className="platAlertTag">{alert.service}</span>}
                    </div>
                    <span className="platAlertTime">{new Date(alert.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Auth0 metrics */}
          <div className="platCard">
            <div className="platCardHeader">
              <IcoActivity />
              <h3>Auth0 tenant</h3>
            </div>
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

          {/* Resolved alerts */}
          <div className="platCard">
            <div className="platCardHeader">
              <IcoCheck />
              <h3>Recently resolved</h3>
            </div>
            <div className="platAlertList">
              {PLATFORM_ALERTS.filter((a) => a.resolved).map((alert) => (
                <div key={alert.id} className="platAlertItem platAlertItem--resolved">
                  <span className="platAlertIconGreen"><IcoCheck /></span>
                  <div className="platAlertContent">
                    <p className="platAlertTitle">{alert.title}</p>
                    <p className="platAlertDetail">{alert.detail}</p>
                  </div>
                  <span className="platAlertIconGrey"><IcoClock /></span>
                </div>
              ))}
              {PLATFORM_ALERTS.filter((a) => a.resolved).length === 0 && (
                <p className="platAlertEmpty">No recently resolved alerts.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
