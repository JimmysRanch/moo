import React from "react";

type KPI = { value: string; unit?: string; label: string; accent: "blue" | "amber" | "green"; icon?: React.ReactNode };
type BarSeries = { title: string; accent: "blue" | "amber"; labels: string[]; values: number[]; valueFmt?: (v: number) => string };
type ListRow = { left: string; right: string };
type SectionedList = { topTitle: string; topRows: ListRow[]; bottomTitle: string; bottomRows: ListRow[] };
type Matrix = { cols: string[]; rows: { name: string; cells: (string | null)[] }[] };

export default function GroomerPerformanceP4() {
  const data: {
    kpis: KPI[];
    charts: BarSeries[];
    earningsByBreed: ListRow[];
    combos: SectionedList;
    rpmMatrix: Matrix;
  } = {
    kpis: [
      { value: "64", unit: "mins", label: "AVG MINUTES / APPOINTMENT", accent: "blue", icon: <ClockIcon /> },
      { value: "$3.75", label: "REVENUE PER MIN | RPM", accent: "amber", icon: <DollarIcon /> },
      { value: "75", label: "COMPLETED APPOINTMENTS", accent: "green", icon: <PawIcon /> },
    ],
    charts: [
      {
        title: "RPM (Monthly)",
        accent: "blue",
        labels: ["JAN", "FEB", "MAR", "APR", "MAY"],
        values: [2.02, 1.92, 1.94, 1.96, 1.97],
        valueFmt: (v: number) => `$${v.toFixed(2)}`,
      },
      {
        title: "Average Minutes per Appointment (Monthly)",
        accent: "blue",
        labels: ["JAN", "FEB", "MAR", "APR", "MAY"],
        values: [42, 45, 46, 46, 47],
        valueFmt: (v: number) => `${Math.round(v)} mins`,
      },
      {
        title: "RPM by Dog Size",
        accent: "amber",
        labels: ["Small Dogs", "Medium Dogs", "Large Dogs"],
        values: [1.56, 1.95, 2.24],
        valueFmt: (v: number) => `$${v.toFixed(2)}`,
      },
    ],
    earningsByBreed: [
      { left: "Golden Retrievers", right: "$1.77" },
      { left: "Cavaliers", right: "$1.72" },
      { left: "Dachshunds", right: "$1.65" },
      { left: "Poodles", right: "$1.58" },
      { left: "Maltese", right: "$1.52" },
      { left: "Goldendoodles", right: "$1.35" },
      { left: "Labradors", right: "$1.35" },
    ],
    combos: {
      topTitle: "Top Performing Breed & Size Combinations",
      topRows: [
        { left: "Golden Retrievers Large", right: "$1.77" },
        { left: "Cavaliers Small", right: "$1.72" },
        { left: "Dachshunds Small", right: "$1.65" },
      ],
      bottomTitle: "Lowest Performing Breed & Size Combinations",
      bottomRows: [
        { left: "Goldendoodles Large", right: "$1.22" },
        { left: "Labradors Large", right: "$1.18" },
        { left: "Mixed Breed X-Large", right: "$1.05" },
      ],
    },
    rpmMatrix: {
      cols: ["Small", "Medium", "Large", "X-Large"],
      rows: [
        { name: "Cavalier", cells: ["$1.72", null, null, null] },
        { name: "Dachshund", cells: ["$1.65", null, null, null] },
        { name: "Bichon Frise", cells: ["$1.58", "$1.41", "$1.41", "$1.48"] },
        { name: "Golden Retriever", cells: ["$1.58", "$1.52", "$1.60", "$1.61"] },
        { name: "Goldendoodle", cells: [null, "$1.55", "$1.60", null] },
        { name: "Labradoodle", cells: ["$1.35", "$1.35", "$1.60", null] },
        { name: "Labrador", cells: ["$1.35", "$1.65", "$1.60", null] },
      ],
    },
  };

  return (
    <>
      <style>{`
        :root{
          --bg0:#050915;
          --bg1:#071326;
          --card0: rgba(10,14,22,.74);
          --card1: rgba(12,16,26,.62);
          --text: rgba(255,255,255,.92);
          --muted: rgba(255,255,255,.72);
          --blue: 84, 210, 255;
          --amber: 255, 180, 77;
          --green: 116, 255, 158;
          --radius: 18px;
          --innerRadius: 14px;
        }

        *{ box-sizing:border-box; }
        
        .p4Wrap{
          min-height: 100vh;
          padding: 32px 28px 48px;
          display:grid;
          place-items:center;
          color: var(--text);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
          background:
            radial-gradient(1200px 760px at 50% 4%, rgba(120,140,255,.18), transparent 55%),
            radial-gradient(1000px 760px at 18% 74%, rgba(var(--blue), .12), transparent 58%),
            radial-gradient(1000px 760px at 88% 74%, rgba(var(--amber), .12), transparent 58%),
            radial-gradient(900px 560px at 50% 115%, rgba(0,0,0,.80), transparent 55%),
            linear-gradient(180deg, var(--bg0), var(--bg1));
        }

        .p4Stage{
          width: min(1340px, 100%);
          position: relative;
          perspective: 1600px;
          perspective-origin: 50% 30%;
        }

        .p4Scene{
          position: relative;
          transform-style: preserve-3d;
        }

        .p4Row{
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          margin-bottom: 18px;
          transform-style: preserve-3d;
        }

        .p4Row1{
          transform: translateZ(80px) rotateX(0deg);
        }

        .p4Row2{
          transform: translateZ(0px) rotateX(-7deg);
        }

        .p4Row3{
          transform: translateZ(-90px) rotateX(-12deg);
          position: relative;
        }

        .p4Pedestal{
          position: absolute;
          left: 2%;
          right: 2%;
          bottom: -48px;
          height: 92px;
          pointer-events: none;
          z-index: -1;
          transform: translateZ(-30px) rotateX(-12deg);
        }

        .p4Pedestal::before{
          content:"";
          position:absolute;
          inset: 0;
          border-radius: 24px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.03) 20%, rgba(0,0,0,.45) 100%);
          box-shadow:
            0 0 0 1px rgba(255,255,255,.08) inset,
            0 45px 100px rgba(0,0,0,.75),
            0 20px 60px rgba(0,0,0,.60);
          filter: blur(1px);
        }

        .p4Pedestal::after{
          content:"";
          position:absolute;
          left: 10%;
          right: 10%;
          top: 12px;
          height: 8px;
          border-radius: 999px;
          background: radial-gradient(closest-side, rgba(255,255,255,.16), transparent 65%);
          opacity:.40;
        }

        .p4Card{
          position:relative;
          border-radius: var(--radius);
          padding: 12px;
          overflow:hidden;
          background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
          box-shadow:
            0 32px 80px rgba(0,0,0,.65),
            0 0 0 1px rgba(255,255,255,.08) inset;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .p4Card::before{
          content:"";
          position:absolute;
          inset: -2px;
          border-radius: calc(var(--radius) + 2px);
          pointer-events:none;
          background:
            radial-gradient(620px 260px at 18% 22%, rgba(var(--glow), .36), transparent 62%),
            radial-gradient(620px 260px at 84% 36%, rgba(255,255,255,.11), transparent 62%),
            linear-gradient(180deg, rgba(255,255,255,.12), transparent 42%);
          opacity: .92;
        }

        .p4Card::after{
          content:"";
          position:absolute;
          inset: 0;
          border-radius: var(--radius);
          pointer-events:none;
          box-shadow:
            0 0 0 1px rgba(255,255,255,.12) inset,
            0 0 0 1px rgba(0,0,0,.40);
          opacity:.75;
        }

        .p4Inner{
          position:relative;
          height:100%;
          border-radius: var(--innerRadius);
          border: 1px solid rgba(255,255,255,.11);
          background:
            radial-gradient(900px 320px at 20% 16%, rgba(255,255,255,.07), transparent 62%),
            radial-gradient(900px 420px at 82% 100%, rgba(0,0,0,.65), transparent 60%),
            linear-gradient(180deg, var(--card0), var(--card1));
          box-shadow:
            0 0 0 1px rgba(0,0,0,.42) inset,
            0 16px 38px rgba(0,0,0,.38);
          overflow:hidden;
        }

        .p4Inner::before{
          content:"";
          position:absolute;
          inset: 0;
          border-radius: var(--innerRadius);
          pointer-events:none;
          background:
            linear-gradient(180deg, rgba(255,255,255,.16), transparent 32%),
            linear-gradient(0deg, rgba(0,0,0,.48), transparent 40%);
          opacity:.24;
        }

        .blue{ --glow: var(--blue); }
        .amber{ --glow: var(--amber); }
        .green{ --glow: var(--green); }

        .p4Kpi{
          height: 130px;
          padding: 18px 20px;
          display:flex;
          flex-direction:column;
          justify-content:center;
          gap: 8px;
        }
        
        .p4KTop{ display:flex; align-items:center; gap: 14px; }
        
        .p4KIcon{
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display:grid;
          place-items:center;
          border: 1px solid rgba(255,255,255,.13);
          background: rgba(255,255,255,.06);
          box-shadow: 0 0 0 1px rgba(0,0,0,.32) inset;
          opacity:.96;
          flex-shrink: 0;
        }
        
        .p4KValue{
          display:flex;
          align-items:baseline;
          gap: 10px;
          font-weight: 900;
          font-size: 50px;
          line-height: 1;
          letter-spacing: .5px;
          text-shadow: 0 20px 45px rgba(0,0,0,.78);
          white-space:nowrap;
        }
        
        .p4KUnit{ font-size: 17px; font-weight: 800; opacity:.74; }
        
        .p4KLabel{
          font-size: 12px;
          letter-spacing: 2.2px;
          text-transform: uppercase;
          color: rgba(255,255,255,.78);
        }

        .p4Chart{
          height: 270px;
        }

        .p4List{
          height: 280px;
        }

        .p4Hdr{
          height: 46px;
          padding: 13px 16px 0;
          display:flex;
          align-items:center;
          gap: 11px;
          color: rgba(255,255,255,.90);
          font-size: 13px;
          letter-spacing: .4px;
          font-weight: 500;
        }
        
        .p4Dot{
          width: 9px; 
          height: 9px;
          border-radius: 3px;
          background: rgba(var(--glow), .96);
          box-shadow: 0 0 16px rgba(var(--glow), .32);
          flex-shrink: 0;
        }
        
        .p4Body{
          padding: 9px 16px 16px;
          height: calc(100% - 46px);
        }
        
        .p4Slot{
          height:100%;
          border-radius: 13px;
          border: 1px solid rgba(255,255,255,.11);
          background:
            linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
          box-shadow: 0 0 0 1px rgba(0,0,0,.42) inset;
          padding: 11px 13px;
          overflow:auto;
        }

        .p4Bars{
          height:100%;
          display:grid;
          grid-template-columns: repeat(var(--n), 1fr);
          gap: 15px;
          align-items:end;
        }
        
        .p4BarWrap{
          height: 100%;
          display:grid;
          grid-template-rows: auto 1fr auto;
          gap: 11px;
        }
        
        .p4BarVal{
          font-size: 12px;
          color: rgba(255,255,255,.76);
          text-align:center;
          font-weight: 600;
        }
        
        .p4BarTrack{
          height: 100%;
          border-radius: 13px;
          background: rgba(0,0,0,.22);
          border: 1px solid rgba(255,255,255,.09);
          box-shadow: 0 0 0 1px rgba(0,0,0,.38) inset;
          display:flex;
          align-items:flex-end;
          overflow:hidden;
        }
        
        .p4Bar{
          width: 100%;
          border-radius: 13px 13px 0 0;
          background:
            linear-gradient(180deg,
              rgba(var(--glow), .58),
              rgba(var(--glow), .16));
          box-shadow:
            0 12px 26px rgba(0,0,0,.38) inset,
            0 0 0 1px rgba(255,255,255,.12) inset;
        }
        
        .p4BarLbl{
          font-size: 12px;
          color: rgba(255,255,255,.72);
          text-align:center;
          letter-spacing: .9px;
          font-weight: 500;
        }

        .p4List{
          display:grid;
          gap: 10px;
        }
        
        .p4Li{
          display:grid;
          grid-template-columns: 1fr auto;
          gap: 13px;
          align-items:center;
          padding: 11px 11px;
          border-radius: 13px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.07);
        }
        
        .p4LiL{ 
          color: rgba(255,255,255,.88); 
          font-size: 13px;
        }
        
        .p4LiR{ 
          color: rgba(255,255,255,.94); 
          font-weight: 900; 
          letter-spacing:.3px; 
          font-size: 13px;
        }

        .p4SecTitle{
          margin: 13px 3px 11px;
          font-size: 12px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: rgba(var(--glow), .96);
          font-weight: 600;
        }

        .p4Matrix{
          display:grid;
          gap: 10px;
        }
        
        .p4MHead, .p4MRow{
          display:grid;
          grid-template-columns: 1.45fr repeat(4, .75fr);
          gap:10px;
          align-items:center;
        }
        
        .p4MHead{
          font-size: 11px;
          color: rgba(255,255,255,.64);
          letter-spacing: 1.1px;
          text-transform: uppercase;
          font-weight: 600;
        }
        
        .p4MBreed, .p4MCell{
          padding: 10px 10px;
          border-radius: 13px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.07);
        }
        
        .p4MBreed{ 
          color: rgba(255,255,255,.88); 
          font-size: 13px;
        }
        
        .p4MCell{ 
          text-align:center; 
          font-weight: 900; 
          color: rgba(255,255,255,.94);
          font-size: 13px;
        }
        
        .p4MCell.muted{ 
          color: rgba(255,255,255,.38); 
          font-weight: 700; 
        }

        @media (max-width: 1100px){
          .p4Scene{ transform: rotateX(4deg); }
          .p4Row{ grid-template-columns: 1fr; }
          .p4Pedestal{ display:none; }
        }
      `}</style>

      <div className="p4Wrap">
        <div className="p4Stage">
          <div className="p4Scene">
            <div className="p4Row p4Row1">
              {data.kpis.map((k, i) => (
                <div key={i} className={`p4Card ${k.accent}`}>
                  <div className="p4Inner p4Kpi">
                    <div className="p4KTop">
                      <div className="p4KIcon">{k.icon ?? "•"}</div>
                      <div className="p4KValue">
                        {k.value}
                        {k.unit ? <span className="p4KUnit">{k.unit}</span> : null}
                      </div>
                    </div>
                    <div className="p4KLabel">{k.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p4Row p4Row2">
              {data.charts.map((c, i) => (
                <div key={i} className={`p4Card p4Chart ${c.accent}`}>
                  <div className="p4Inner">
                    <div className="p4Hdr">
                      <div className="p4Dot" />
                      <div>{c.title}</div>
                    </div>
                    <div className="p4Body">
                      <div className="p4Slot">
                        <P4Bars labels={c.labels} values={c.values} valueFmt={c.valueFmt} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p4Row p4Row3">
              <div className="p4Pedestal" />
              
              <div className="p4Card p4List blue">
                <div className="p4Inner">
                  <div className="p4Hdr">
                    <div className="p4Dot" />
                    <div>Earnings by Breed</div>
                  </div>
                  <div className="p4Body">
                    <div className="p4Slot">
                      <P4List rows={data.earningsByBreed} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p4Card p4List amber">
                <div className="p4Inner">
                  <div className="p4Hdr">
                    <div className="p4Dot" />
                    <div>Top Performing Breed &amp; Size Combinations</div>
                  </div>
                  <div className="p4Body">
                    <div className="p4Slot">
                      <div>
                        <P4List rows={data.combos.topRows} />
                        <div className="p4SecTitle">{data.combos.bottomTitle}</div>
                        <P4List rows={data.combos.bottomRows} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p4Card p4List amber">
                <div className="p4Inner">
                  <div className="p4Hdr">
                    <div className="p4Dot" />
                    <div>RPM by Breed &amp; Size</div>
                  </div>
                  <div className="p4Body">
                    <div className="p4Slot">
                      <P4MatrixTable matrix={data.rpmMatrix} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function P4Bars(props: { labels: string[]; values: number[]; valueFmt?: (v: number) => string }) {
  const { labels, values, valueFmt } = props;
  const max = Math.max(...values);
  return (
    <div className="p4Bars" style={{ ["--n" as string]: labels.length }}>
      {labels.map((lbl, i) => {
        const v = values[i] ?? 0;
        const pct = max > 0 ? Math.max(0.12, v / max) : 0.12;
        return (
          <div className="p4BarWrap" key={lbl}>
            <div className="p4BarVal">{valueFmt ? valueFmt(v) : String(v)}</div>
            <div className="p4BarTrack">
              <div className="p4Bar" style={{ height: `${pct * 100}%` }} />
            </div>
            <div className="p4BarLbl">{lbl}</div>
          </div>
        );
      })}
    </div>
  );
}

function P4List(props: { rows: { left: string; right: string }[] }) {
  return (
    <div className="p4List">
      {props.rows.map((r) => (
        <div className="p4Li" key={r.left}>
          <div className="p4LiL">{r.left}</div>
          <div className="p4LiR">{r.right}</div>
        </div>
      ))}
    </div>
  );
}

function P4MatrixTable(props: { matrix: Matrix }) {
  const { cols, rows } = props.matrix;
  return (
    <div className="p4Matrix">
      <div className="p4MHead">
        <div>Breed</div>
        {cols.map((c) => (
          <div key={c}>{c}</div>
        ))}
      </div>
      {rows.map((r) => (
        <div className="p4MRow" key={r.name}>
          <div className="p4MBreed">{r.name}</div>
          {r.cells.map((cell, i) => (
            <div key={`${r.name}-${i}`} className={`p4MCell ${cell ? "" : "muted"}`}>
              {cell ?? "—"}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z" stroke="rgba(255,255,255,.75)" strokeWidth="1.8" />
      <path d="M12 6v6l4 2" stroke="rgba(255,255,255,.75)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DollarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2v20M16.5 7.5c0-1.9-2-3.5-4.5-3.5S7.5 5.6 7.5 7.5 9 10 12 10s4.5 1.6 4.5 3.5S14.5 17 12 17 7.5 15.4 7.5 13.5"
        stroke="rgba(255,255,255,.75)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
function PawIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 14.5c-1.7 0-3 1.2-3 2.7 0 2.2 3 3.8 8 3.8s8-1.6 8-3.8c0-1.5-1.3-2.7-3-2.7-1 0-1.8.4-2.3 1-.6.7-1.5 1.2-2.7 1.2s-2.1-.5-2.7-1.2c-.5-.6-1.3-1-2.3-1Z"
        fill="rgba(255,255,255,.70)"
      />
      <circle cx="7.5" cy="9" r="1.6" fill="rgba(255,255,255,.70)" />
      <circle cx="12" cy="7.5" r="1.6" fill="rgba(255,255,255,.70)" />
      <circle cx="16.5" cy="9" r="1.6" fill="rgba(255,255,255,.70)" />
      <circle cx="9.8" cy="11.2" r="1.2" fill="rgba(255,255,255,.70)" />
      <circle cx="14.2" cy="11.2" r="1.2" fill="rgba(255,255,255,.70)" />
    </svg>
  );
}
