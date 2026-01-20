import { Button } from "@/components/ui/button";
import { Zap, Shield, Clock } from "lucide-react";
import eagleHero from "@/assets/eagle-hero.png";

const Hero = () => {
  return (
    <section className="relative overflow-hidden gradient-hero py-16 md:py-24">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-72 h-72 bg-secondary rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 mb-6">
              <Zap className="h-4 w-4 text-secondary" />
              <span className="text-sm font-medium text-primary-foreground">Instant Recharge</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-primary-foreground leading-tight mb-6">
              Buy Airtime & Data{" "}
              <span className="text-gradient-gold">Instantly</span>
            </h1>

            <p className="text-lg text-primary-foreground/80 mb-8 max-w-lg mx-auto lg:mx-0">
              Nigeria's trusted platform for fast, reliable mobile top-ups. Recharge any network in seconds with THE EAGLES.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button variant="hero" size="xl">
                Recharge Now
              </Button>
              <Button variant="outline" size="xl" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                View Data Plans
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-6 mt-10 justify-center lg:justify-start">
              <div className="flex items-center gap-2 text-primary-foreground/70">
                <Shield className="h-5 w-5 text-secondary" />
                <span className="text-sm">Secure Payments</span>
              </div>
              <div className="flex items-center gap-2 text-primary-foreground/70">
                <Clock className="h-5 w-5 text-secondary" />
                <span className="text-sm">24/7 Service</span>
              </div>
              <div className="flex items-center gap-2 text-primary-foreground/70">
                <Zap className="h-5 w-5 text-secondary" />
                <span className="text-sm">Instant Delivery</span>
              </div>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="relative animate-float">
              <img
                src={eagleHero}
                alt="The Eagles - Nigeria's Trusted VTU Platform"
                className="w-full max-w-md mx-auto rounded-2xl shadow-elevated"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
