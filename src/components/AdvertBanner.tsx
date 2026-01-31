import { Gift, Building2, Briefcase, Sparkles } from "lucide-react";

const adverts = [
  {
    icon: Gift,
    text: "🎉 Refer a friend and earn ₦1,000 bonus each!",
    color: "text-purple-400",
  },
  {
    icon: Building2,
    text: "🏢 Coming Soon: Company & Business Registration",
    color: "text-blue-400",
  },
  {
    icon: Briefcase,
    text: "📋 CAC Registration services launching soon!",
    color: "text-emerald-400",
  },
  {
    icon: Sparkles,
    text: "⚡ Instant airtime & data delivery - 24/7",
    color: "text-yellow-400",
  },
];

const AdvertBanner = () => {
  return (
    <div className="w-full overflow-hidden bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 rounded-xl py-3 mb-6">
      <div className="flex animate-marquee whitespace-nowrap">
        {/* Double the content for seamless loop */}
        {[...adverts, ...adverts].map((ad, index) => (
          <div
            key={index}
            className="flex items-center gap-2 mx-8"
          >
            <ad.icon className={`h-4 w-4 ${ad.color} shrink-0`} />
            <span className="text-sm font-medium text-foreground">{ad.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdvertBanner;
