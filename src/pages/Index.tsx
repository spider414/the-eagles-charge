import Header from "@/components/Header";
import Hero from "@/components/Hero";
import AirtimeForm from "@/components/AirtimeForm";
import DataForm from "@/components/DataForm";
import Features from "@/components/Features";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        <Hero />
        
        {/* Services Section */}
        <section id="services" className="py-16 md:py-24">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Quick <span className="text-gradient-gold">Recharge</span>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Top up your phone instantly with airtime or data bundles
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto" id="airtime">
              <div id="airtime-section" className="animate-fade-in" style={{ animationDelay: "100ms" }}>
                <AirtimeForm />
              </div>
              <div id="data" className="animate-fade-in" style={{ animationDelay: "200ms" }}>
                <DataForm />
              </div>
            </div>
          </div>
        </section>

        <Features />
      </main>

      <Footer />
    </div>
  );
};

export default Index;
