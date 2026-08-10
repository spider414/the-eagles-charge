import { Zap, Shield, Clock, Headphones, CreditCard, Gift } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Instant Delivery",
    description: "Airtime and data delivered within seconds of payment confirmation",
  },
  {
    icon: Shield,
    title: "Secure Payments",
    description: "Powered by Paystack with bank-grade security for all transactions",
  },
  {
    icon: Clock,
    title: "24/7 Available",
    description: "Recharge anytime, anywhere. Our service never sleeps",
  },
  {
    icon: Headphones,
    title: "Customer Support",
    description: "Dedicated support team ready to help with any issues",
  },
  {
    icon: CreditCard,
    title: "Multiple Payment Options",
    description: "Pay with cards, bank transfer, or USSD",
  },
  {
    icon: Gift,
    title: "Referral Rewards",
    description: "Earn rewards on each person you invite to join the platform",
  },
];

const Features = () => {
  return (
    <section id="about" className="py-16 md:py-24 bg-muted/50">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Why Choose <span className="text-gradient-gold">HARMIC RECHARGE</span>?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Experience the fastest, most reliable VTU service in Nigeria
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group p-6 bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-card transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-gold shadow-gold mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="h-6 w-6 text-secondary-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
