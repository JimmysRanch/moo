import "@/styles/hud.css";

const rpmMonthly = [
  { label: "JAN", value: 1.92 },
  { label: "FEB", value: 1.94 },
  { label: "MAR", value: 1.96 },
  { label: "APR", value: 1.96 },
  { label: "MAY", value: 1.97 },
];

const minsMonthly = [
  { label: "JAN", value: 42 },
  { label: "FEB", value: 45 },
  { label: "MAR", value: 46 },
  { label: "APR", value: 46 },
  { label: "MAY", value: 47 },
];

const sizeRPM = [
  { label: "Small Dogs", value: 1.56 },
  { label: "Medium Dogs", value: 1.95 },
  { label: "Large Dogs", value: 2.24 },
];

export default function StaffPerformanceHudP7() {
  return (
    <div className="hud-root">
      <div className="hud-background" />

      <div className="hud-container">
        {/* ROW 1 – KPIs */}
        <div className="hud-grid hud-grid-3 hud-row-kpi">
          <div className="hud-card hud-cyan">
            <div className="hud-kpi">
              <span className="hud-kpi-value">64</span>
              <span className="hud-kpi-unit">mins</span>
            </div>
            <div className="hud-kpi-label">AVG MINUTES / APPOINTMENT</div>
          </div>

          <div className="hud-card hud-gold">
            <div className="hud-kpi">$3.75</div>
            <div className="hud-kpi-label">REVENUE PER MIN | RPM</div>
          </div>

          <div className="hud-card hud-green">
            <div className="hud-kpi">75</div>
            <div className="hud-kpi-label">COMPLETED APPOINTMENTS</div>
          </div>
        </div>

        {/* ROW 2 – CHARTS */}
        <div className="hud-grid hud-grid-3 hud-row-charts">
          <ChartCard title="RPM (Monthly)" data={rpmMonthly} prefix="$" />
          <ChartCard title="Average Minutes per Appointment (Monthly)" data={minsMonthly} suffix=" mins" />
          <ChartCard title="RPM by Dog Size" data={sizeRPM} prefix="$" />
        </div>

        {/* PEDESTAL */}
        <div className="hud-pedestal" />

        {/* ROW 3 – TABLES */}
        <div className="hud-grid hud-grid-3 hud-row-bottom">
          <div className="hud-card">
            <h4>Earnings by Breed</h4>
            <ul className="hud-list">
              <li><span>Golden Retrievers</span><span>$1.77</span></li>
              <li><span>Cavaliers</span><span>$1.72</span></li>
              <li><span>Dachshunds</span><span>$1.65</span></li>
              <li><span>Poodles</span><span>$1.58</span></li>
              <li><span>Maltese</span><span>$1.52</span></li>
            </ul>
          </div>

          <div className="hud-card">
            <h4>Top Performing Breed & Size</h4>
            <ul className="hud-list">
              <li><span>Golden Retrievers (Large)</span><span>$1.77</span></li>
              <li><span>Cavaliers (Small)</span><span>$1.72</span></li>
              <li><span>Dachshunds (Small)</span><span>$1.65</span></li>
            </ul>
          </div>

          <div className="hud-card">
            <h4>RPM by Breed & Size</h4>
            <table className="hud-table">
              <thead>
                <tr>
                  <th>Breed</th>
                  <th>Small</th>
                  <th>Medium</th>
                  <th>Large</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Cavalier</td><td>$1.72</td><td>—</td><td>—</td></tr>
                <tr><td>Dachshund</td><td>$1.65</td><td>—</td><td>—</td></tr>
                <tr><td>Bichon Frise</td><td>$1.58</td><td>$1.41</td><td>$1.41</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  data,
  prefix = "",
  suffix = "",
}: {
  title: string;
  data: { label: string; value: number }[];
  prefix?: string;
  suffix?: string;
}) {
  const max = Math.max(...data.map(d => d.value));

  return (
    <div className="hud-card">
      <h4>{title}</h4>
      <div className="hud-bars">
        {data.map(d => (
          <div key={d.label} className="hud-bar-col">
            <div className="hud-bar-value">
              {prefix}{d.value}{suffix}
            </div>
            <div
              className="hud-bar"
              style={{ height: `${(d.value / max) * 100}%` }}
            />
            <div className="hud-bar-label">{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
