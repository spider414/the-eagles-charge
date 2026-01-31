import { useNavigate } from "react-router-dom";
import { Gift, Building2, Briefcase, Sparkles } from "lucide-react";

interface Advert {
  icon: typeof Gift;
  text: string;
  color: string;
  href: string;
}

const adverts: Advert[] = [
  {
    icon: Gift,
    text: "🎉 Refer a friend and earn ₦1,000 bonus each!",
    color: "text-purple-400",
    href: "/referrals",
  },
  {
    icon: Building2,
    text: "🏢 Coming Soon: Company & Business Registration",
    color: "text-blue-400",
    href: "/coming-soon",
  },
  {
    icon: Briefcase,
    text: "📋 CAC Registration services launching soon!",
    color: "text-emerald-400",
    href: "/coming-soon",
  },
  {
    icon: Sparkles,
    text: "⚡ Instant airtime & data delivery - 24/7",
    color: "text-yellow-400",
    href: "/airtime",
  },
];

const AdvertBanner = () => {
  const navigate = useNavigate();

  const handleClick = (href: string) => {
    navigate(href);
  };

  return (
    <div className="w-full overflow-hidden bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 rounded-xl py-3 mb-6">
      <div className="flex animate-marquee whitespace-nowrap">
        {/* Double the content for seamless loop */}
        {[...adverts, ...adverts].map((ad, index) => (
          <button
            key={index}
            onClick={() => handleClick(ad.href)}
            className="flex items-center gap-2 mx-8 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <ad.icon className={`h-4 w-4 ${ad.color} shrink-0`} />
            <span className="text-sm font-medium text-foreground">{ad.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AdvertBanner;
