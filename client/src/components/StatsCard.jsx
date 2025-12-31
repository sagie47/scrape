/**
 * @param {object} props
 * @param {React.ReactNode} [props.icon]
 * @param {string} props.title
 * @param {string|number} props.value
 * @param {string} [props.subtext]
 * @param {string} [props.className]
 */
export default function StatsCard({ icon, title, value, subtext, className = '' }) {
    return (
        <div className={`widget stats-card quarter-width ${className}`.trim()}>
            <div className="stats-card-header">
                <div className="stats-card-title">
                    {icon && <span className="stats-card-icon">{icon}</span>}
                    {title}
                </div>
            </div>
            <div className="stats-card-value">{value}</div>
            {subtext && <div className="stat-label">{subtext}</div>}
        </div>
    );
}
