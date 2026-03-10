import { useNavigate } from "react-router-dom";
import { Gift, Building2, Briefcase, Sparkles, Wifi, Phone, Zap, Tv, Shield, Fingerprint } from "lucide-react";
import { useState, useEffect } from "react";

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
    text: "🏢 CAC Business Registration – BN, LTD & NGO available now!",
    color: "text-blue-400",
    href: "/business-services",
  },
  {
    icon: Briefcase,
    text: "📋 TIN Registration – Individual ₦800, Corporate ₦1,200",
    color: "text-emerald-400",
    href: "/tin-registration",
  },
  {
    icon: Sparkles,
    text: "⚡ Instant airtime & data delivery - 24/7",
    color: "text-yellow-400",
    href: "/airtime",
  },
  {
    icon: Fingerprint,
    text: "🔐 NIN & BVN Verification – Fast & reliable from ₦300",
    color: "text-teal-400",
    href: "/verification",
  },
  {
    icon: Wifi,
    text: "📶 Buy cheap data bundles for all networks!",
    color: "text-green-400",
    href: "/data",
  },
  {
    icon: Zap,
    text: "💡 Pay electricity bills instantly – All DisCos supported",
    color: "text-amber-400",
    href: "/bills/electricity",
  },
  {
    icon: Tv,
    text: "📺 Cable TV subscriptions – DStv, GOtv, Startimes",
    color: "text-pink-400",
    href: "/bills/cable",
  },
  {
    icon: Shield,
    text: "🛡️ SCUML Registration – Stay compliant for ₦15,000",
    color: "text-indigo-400",
    href: "/scuml-registration",
  },
];

const AdvertBanner = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % adverts.length);
        setIsVisible(true);
      }, 500);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const currentAd = adverts[currentIndex];

  return (
    <div className="w-full overflow-hidden bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 rounded-xl py-3 pb-4 mb-6">
      <button
        onClick={() => navigate(currentAd.href)}
        className={`flex items-center gap-2 w-full justify-center hover:opacity-80 cursor-pointer px-4 transition-all duration-500 ease-in-out ${
          isVisible
            ? "opacity-100 translate-x-0"
            : "opacity-0 -translate-x-full"
        }`}
      >
        <currentAd.icon className={`h-4 w-4 ${currentAd.color} shrink-0`} />
        <span className="text-sm font-medium text-foreground">{currentAd.text}</span>
      </button>
      <div className="flex items-center justify-center gap-1.5 mt-2">
        {adverts.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setIsVisible(false);
              setTimeout(() => {
                setCurrentIndex(index);
                setIsVisible(true);
              }, 300);
            }}
            className={`rounded-full transition-all duration-300 ${
              index === currentIndex
                ? "w-4 h-1.5 bg-primary"
                : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default AdvertBanner;
