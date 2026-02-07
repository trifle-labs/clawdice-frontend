interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
}

export function StatCard({ label, value, subValue, icon, trend }: StatCardProps) {
  return (
    <div className="glass rounded-xl p-6 hover:glow-primary transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{label}</p>
          <p className="text-2xl md:text-3xl font-bold">{value}</p>
          {subValue && (
            <p
              className={`text-sm mt-1 ${
                trend === "up"
                  ? "text-success"
                  : trend === "down"
                  ? "text-danger"
                  : "text-gray-400"
              }`}
            >
              {trend === "up" && "↑ "}
              {trend === "down" && "↓ "}
              {subValue}
            </p>
          )}
        </div>
        {icon && <div className="text-primary opacity-50">{icon}</div>}
      </div>
    </div>
  );
}
