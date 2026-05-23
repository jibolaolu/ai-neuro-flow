import { RoleDashboardShell } from "../../../components/role-dashboard-shell";
import { getSuperAdminNav } from "../../../lib/super-admin-nav";
import { serverAuthedGetJson } from "../../../lib/api-server";
import type { SystemStatus } from "../../../lib/api";
import { INFRA_SERVICES } from "../../../lib/super-admin-data";

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`platDot ${ok ? "platDotGreen" : "platDotRed"}`} />;
}

export default async function InfrastructurePage() {
  const systemStatus = await serverAuthedGetJson<SystemStatus>("/api/v1/system/status");

  const liveServices = systemStatus?.services ?? [];
  const healthyLive = liveServices.filter((s) => s.status === "ok").length;
  const totalLive = liveServices.length;

  return (
    <RoleDashboardShell
      role="super-admin"
      roleLabel="Super Platform Admin"
      sectionLabel="Infrastructure"
      title="Service health"
      navGroups={getSuperAdminNav("/super-admin/infrastructure")}
    >
      <div className="page-shell">
        <div className="platShell">
          <div className="platHeader">
            <div>
              <h2 className="platHeaderTitle">Infrastructure Health</h2>
              <p className="platHeaderSub">
                {systemStatus
                  ? `Live: ${healthyLive}/${totalLive} services healthy · checked ${new Date(systemStatus.checked_at).toLocaleTimeString("en-GB")}`
                  : "Backend unreachable — showing mock baseline data"}
              </p>
            </div>
          </div>

          {systemStatus && (
            <div className="platCard">
              <div className="platCardHeader">
                <h3>Live backend health check</h3>
                <span className={`platCardCount ${healthyLive === totalLive ? "" : "platCardCountRed"}`}>
                  {healthyLive}/{totalLive} OK
                </span>
              </div>
              <div className="platTableWrap">
                <table className="platTable">
                  <thead>
                    <tr><th>Service</th><th>Status</th><th>Detail</th></tr>
                  </thead>
                  <tbody>
                    {liveServices.map((svc) => (
                      <tr key={svc.name}>
                        <td><span className="platSubName">{svc.name}</span></td>
                        <td>
                          <div className="platHealthCell">
                            <StatusDot ok={svc.status === "ok"} />
                            <span>{svc.status === "ok" ? "Healthy" : svc.status}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{svc.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="platCard">
            <div className="platCardHeader">
              <h3>Platform services</h3>
              <span className="platCardCount">{INFRA_SERVICES.length}</span>
            </div>
            <div className="platInfraGrid">
              {INFRA_SERVICES.map((svc) => {
                const cap = svc.status.charAt(0).toUpperCase() + svc.status.slice(1);
                return (
                  <div key={svc.id} className={`platInfraCard platInfra${cap}`}>
                    <div className="platInfraTop">
                      <span className={`platDot platDot${svc.status === "healthy" ? "Green" : svc.status === "degraded" ? "Amber" : "Red"}`} />
                      <span className="platInfraName">{svc.name}</span>
                    </div>
                    <div className="platInfraMeta">
                      <span>{svc.uptime99d}% uptime</span>
                      <span>{svc.avgResponseMs}ms avg</span>
                      <span>{svc.p99ResponseMs}ms p99</span>
                      <span className="platInfraRegion">{svc.region}</span>
                    </div>
                    {svc.notes && <p className="platInfraNotes">{svc.notes}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </RoleDashboardShell>
  );
}
