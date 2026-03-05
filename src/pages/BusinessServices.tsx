import { ArrowLeft, Building2, FileText, Shield, Award, ArrowRight, Clock, CheckCircle2, Fingerprint, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";

const services = [
  {
    title: "NIN/BVN Verification",
    description: "Verify your National Identification Number or Bank Verification Number instantly.",
    icon: Fingerprint,
    path: "/verification",
    prices: ["NIN: ₦300", "BVN: ₦500"],
    processing: "Instant",
    color: "from-teal-500/20 to-teal-600/10",
    iconBg: "bg-teal-500/15 text-teal-600",
  },
  {
    title: "Print NIN Slip",
    description: "Generate and print your official NIN slip with full details.",
    icon: Printer,
    path: "/nin-print",
    prices: ["From ₦350"],
    processing: "Instant",
    color: "from-indigo-500/20 to-indigo-600/10",
    iconBg: "bg-indigo-500/15 text-indigo-600",
  },
  {
    title: "Print BVN Slip",
    description: "Generate and print your official BVN slip with full details.",
    icon: Printer,
    path: "/bvn-print",
    prices: ["From ₦350"],
    processing: "Instant",
    color: "from-violet-500/20 to-violet-600/10",
    iconBg: "bg-violet-500/15 text-violet-600",
  },
  {
    title: "CAC Registration",
    description: "Register your Business Name, Limited Company, or NGO with the Corporate Affairs Commission.",
    icon: Building2,
    path: "/cac-registration",
    prices: ["BN: ₦40,000", "LTD: ₦75,000", "IT: ₦80,000"],
    processing: "5–7 working days",
    color: "from-emerald-500/20 to-emerald-600/10",
    iconBg: "bg-emerald-500/15 text-emerald-600",
  },
  {
    title: "TIN Registration",
    description: "Obtain your Tax Identification Number for individual or corporate filings with FIRS.",
    icon: FileText,
    path: "/tin-registration",
    prices: ["Individual: ₦800", "Corporate: ₦1,200"],
    processing: "24 hours",
    color: "from-blue-500/20 to-blue-600/10",
    iconBg: "bg-blue-500/15 text-blue-600",
  },
  {
    title: "SCUML Registration",
    description: "Register with the Special Control Unit against Money Laundering for compliance.",
    icon: Shield,
    path: "/scuml-registration",
    prices: ["₦15,000"],
    processing: "3–5 working days",
    color: "from-amber-500/20 to-amber-600/10",
    iconBg: "bg-amber-500/15 text-amber-600",
  },
  {
    title: "IPE Clearance",
    description: "Get your Immigration & Prison Entry clearance certificate for official purposes.",
    icon: Award,
    path: "/ipe-clearance",
    prices: ["₦20,000"],
    processing: "5–7 working days",
    color: "from-purple-500/20 to-purple-600/10",
    iconBg: "bg-purple-500/15 text-purple-600",
  },
];

const BusinessServices = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#006838] to-[#008751] text-white">
        <div className="container py-6">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/20">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Business Services</h1>
              <p className="text-white/80 text-sm">Government registrations & compliance made easy</p>
            </div>
          </div>
          <div className="flex items-center gap-6 mt-4 text-sm text-white/70">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Verified agents</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Fast processing</span>
            <span className="flex items-center gap-1.5"><Shield className="h-4 w-4" /> Secure payments</span>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {services.map((service) => (
            <Link
              key={service.path}
              to={service.path}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${service.iconBg}`}>
                    <service.icon className="h-6 w-6" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1.5">{service.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{service.description}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {service.prices.map((price) => (
                    <span key={price} className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                      {price}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Processing: {service.processing}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BusinessServices;
