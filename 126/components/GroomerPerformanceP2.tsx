export default function GroomerPerformanceP2() {
  return (
    <>
      <style>{`
        :root{
          --bg0:#050915;
          --bg1:#071326;

          --panel: rgba(12,18,32,.55);
          --panel2: rgba(10,14,24,.72);

          --stroke: rgba(255,255,255,.10);
          --strokeSoft: rgba(255,255,255,.06);

          --text: rgba(255,255,255,.92);
          --muted: rgba(255,255,255,.70);
          --muted2: rgba(255,255,255,.45);

          --blue: 84, 210, 255;
          --amber: 255, 180, 77;
          --green: 116, 255, 158;
        }

        *{ box-sizing:border-box; }

        .gpPage{
          min-height: calc(100vh - 56px);
          padding: 28px 28px 38px;
          display: grid;
          place-items: center;
          color: var(--text);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
          background:
            radial-gradient(1200px 800px at 50% 5%, rgba(120,140,255,.18), transparent 55%),
            radial-gradient(900px 700px at 20% 70%, rgba(var(--blue), .12), transparent 58%),
            radial-gradient(900px 700px at 85% 75%, rgba(var(--amber), .12), transparent 58%),
            radial-gradient(700px 500px at 92% 18%, rgba(0,0,0,.55), transparent 70%),
            linear-gradient(180deg, var(--bg0), var(--bg1));
        }

        .gpStage{
          width: min(1320px, 100%);
          display: grid;
          gap: 18px;
        }

        .gpRow3{
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }

        /* ---------- shared glass card shell ---------- */
        .gpShell{
          position: relative;
          border-radius: 18px;
          padding: 12px;
          overflow: hidden;

          background:
            linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
          box-shadow:
            0 30px 90px rgba(0,0,0,.62),
            0 0 0 1px rgba(255,255,255,.07) inset;

          /* glass blur */
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .gpShell::before{
          /* soft corner bloom */
          content:"";
          position:absolute; inset:-2px;
          border-radius: 20px;
          opacity:.85;
          pointer-events:none;
          background:
            radial-gradient(520px 200px at 18% 25%, rgba(var(--blue), .22), transparent 62%),
            radial-gradient(520px 200px at 82% 35%, rgba(255,255,255,.07), transparent 62%);
        }

        .gpShell.amber::before{
          background:
            radial-gradient(520px 200px at 18% 25%, rgba(var(--amber), .22), transparent 62%),
            radial-gradient(520px 200px at 82% 35%, rgba(255,255,255,.07), transparent 62%);
        }

        .gpShell.green::before{
          background:
            radial-gradient(520px 200px at 18% 25%, rgba(var(--green), .18), transparent 62%),
            radial-gradient(520px 200px at 82% 35%, rgba(255,255,255,.07), transparent 62%);
        }

        .gpShell::after{
          /* subtle top highlight + vignette */
          content:"";
          position:absolute; inset:0;
          pointer-events:none;
          background:
            linear-gradient(180deg, rgba(255,255,255,.10), transparent 35%),
            radial-gradient(900px 280px at 50% 120%, rgba(0,0,0,.55), transparent 55%);
          opacity:.25;
        }

        .gpInner{
          position: relative;
          border-radius: 14px;
          background:
            radial-gradient(800px 260px at 20% 20%, rgba(255,255,255,.05), transparent 60%),
            linear-gradient(180deg, rgba(8,12,22,.72), rgba(6,10,18,.82));
          border: 1px solid rgba(255,255,255,.09);
          box-shadow:
            0 0 0 1px rgba(0,0,0,.35) inset,
            0 12px 30px rgba(0,0,0,.35);
        }

        /* ---------- KPI cards ---------- */
        .gpKpi{
          height: 118px;
          padding: 16px 18px;
          display:flex;
          flex-direction:column;
          justify-content:center;
          gap: 6px;
        }

        .gpKpiTop{
          display:flex;
          align-items:center;
          gap: 12px;
        }

        .gpIcon{
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display:grid;
          place-items:center;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.10);
          box-shadow: 0 0 0 1px rgba(0,0,0,.25) inset;
          opacity:.95;
        }

        .gpValue{
          display:flex;
          align-items:baseline;
          gap: 8px;
          font-weight: 800;
          letter-spacing: .3px;
          text-shadow: 0 16px 40px rgba(0,0,0,.70);
          font-size: 44px;
          line-height: 1;
        }

        .gpUnit{
          font-size: 16px;
          font-weight: 700;
          letter-spacing: .3px;
          opacity:.75;
        }

        .gpLabel{
          font-size: 12px;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: rgba(255,255,255,.70);
        }

        /* ---------- Chart cards ---------- */
        .gpCard{
          height: 128px;
          padding: 14px 14px 12px;
          display:flex;
          flex-direction:column;
          gap: 10px;
        }

        .gpHeader{
          display:flex;
          align-items:center;
          gap: 10px;
          font-size: 13px;
          letter-spacing: .4px;
          color: rgba(255,255,255,.86);
        }

        .gpDot{
          width: 8px; height: 8px;
          border-radius: 3px;
          background: rgba(var(--blue), .95);
          box-shadow: 0 0 14px rgba(var(--blue), .25);
        }
        .amber .gpDot{
          background: rgba(var(--amber), .95);
          box-shadow: 0 0 14px rgba(var(--amber), .25);
        }

        .gpChartSlot{
          flex:1;
          border-radius: 12px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
          border: 1px solid rgba(255,255,255,.07);
          box-shadow:
            0 0 0 1px rgba(0,0,0,.35) inset;
          display:flex;
          align-items:center;
          padding: 0 14px;
          color: rgba(255,255,255,.60);
          font-size: 14px;
        }

        /* iPad / smaller */
        @media (max-width: 1100px){
          .gpRow3{ grid-template-columns: 1fr; }
          .gpStage{ width: min(760px, 100%); }
        }
      `}</style>

      <div className="gpPage">
        <div className="gpStage">

          {/* KPI row */}
          <div className="gpRow3">
            <GlassKpi accent="blue" icon="⏱" value="64" unit="mins" label="AVG MINUTES / APPOINTMENT" />
            <GlassKpi accent="amber" icon="$" value="$3.75" unit="" label="REVENUE PER MIN | RPM" />
            <GlassKpi accent="green" icon="🐾" value="75" unit="" label="COMPLETED APPOINTMENTS" />
          </div>

          {/* Chart row */}
          <div className="gpRow3">
            <GlassChart accent="blue" title="RPM (Monthly)" />
            <GlassChart accent="blue" title="Average Minutes per Appointment" />
            <GlassChart accent="amber" title="RPM by Dog Size" />
          </div>

        </div>
      </div>
    </>
  );
}

function GlassKpi(props: { accent: "blue" | "amber" | "green"; icon: string; value: string; unit: string; label: string }) {
  const shellClass = `gpShell ${props.accent === "amber" ? "amber" : props.accent === "green" ? "green" : ""}`;
  return (
    <div className={shellClass}>
      <div className="gpInner gpKpi">
        <div className="gpKpiTop">
          <div className="gpIcon">{props.icon}</div>
          <div className="gpValue">
            {props.value}
            {props.unit ? <span className="gpUnit">{props.unit}</span> : null}
          </div>
        </div>
        <div className="gpLabel">{props.label}</div>
      </div>
    </div>
  );
}

function GlassChart(props: { accent: "blue" | "amber"; title: string }) {
  const shellClass = `gpShell ${props.accent === "amber" ? "amber" : ""}`;
  return (
    <div className={shellClass + (props.accent === "amber" ? " amber" : "")}>
      <div className="gpInner gpCard">
        <div className="gpHeader">
          <div className="gpDot" />
          <div>{props.title}</div>
        </div>
        <div className="gpChartSlot">Chart placeholder</div>
      </div>
    </div>
  );
}
