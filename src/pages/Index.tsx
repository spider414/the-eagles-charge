import { useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import AirtimeForm from "@/components/AirtimeForm";
import DataForm from "@/components/DataForm";
import Features from "@/components/Features";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Index = () => {
  const [selectedService, setSelectedService] = useState<string>("airtime");

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
              <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
                Top up your phone instantly with airtime or data bundles
              </p>

              {/* Service Dropdown */}
              <div className="max-w-xs mx-auto">
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger className="w-full h-12 text-base bg-card border-border">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="airtime" className="cursor-pointer">
                      Buy Airtime
                    </SelectItem>
                    <SelectItem value="data" className="cursor-pointer">
                      Buy Data Bundle
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="max-w-lg mx-auto animate-fade-in">
              {selectedService === "airtime" ? (
                <div id="airtime-section">
                  <AirtimeForm />
                </div>
              ) : (
                <div id="data-section">
                  <DataForm />
                </div>
              )}
            </div>
          </div>
        </section>

        <Features />
        <FAQ />
      </main>

      <Footer />
    </div>
  );
};

export default Index;
