import { SENTIMENT_TOPICS } from '@/lib/consoleData';

export default function SentimentView() {
  return (
    <div className="fade-in">
      <div className="stats-row" style={{gridTemplateColumns:'repeat(3,1fr)', marginBottom:16}}>
        {[
          {label:'Overall sentiment', val:'+0.62', cls:'green'},
          {label:'Negative signals',  val:'28%',   cls:'rust'},
          {label:'Topics tracked',    val:'14',     cls:''},
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-val ${s.cls}`} style={{fontSize:28}}>{s.val}</div>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head"><span className="panel-title">Topic Sentiment Breakdown</span></div>
        <div className="sentiment-map">
          {SENTIMENT_TOPICS.map((t, i) => (
            <div className="sentiment-topic" key={i}>
              <div className="sent-title">{t.topic}</div>
              <div className="sent-bars">
                {[
                  {label:'Positive', val:t.pos, cls:'pos'},
                  {label:'Negative', val:t.neg, cls:'neg'},
                  {label:'Neutral',  val:t.neu, cls:'neu'},
                ].map((row, j) => (
                  <div className="sent-row" key={j}>
                    <span className="sent-label">{row.label}</span>
                    <div className="sent-bar"><div className={`sent-fill ${row.cls}`} style={{width:`${row.val}%`}}></div></div>
                    <span className="sent-pct">{row.val}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
