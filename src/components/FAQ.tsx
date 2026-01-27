import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How long does it take for airtime/data to be delivered?",
    answer: "Airtime and data are delivered instantly, usually within seconds of successful payment. In rare cases of network delays, delivery may take up to 5 minutes.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major debit/credit cards, bank transfers, USSD payments, and wallet balance. All payments are secured by Paystack.",
  },
  {
    question: "Is my payment information safe?",
    answer: "Yes, absolutely! We use Paystack, a PCI-DSS compliant payment processor, which means your card details are encrypted and never stored on our servers.",
  },
  {
    question: "What happens if my transaction fails?",
    answer: "If a transaction fails after payment, the amount will be automatically refunded to your wallet. You can then retry the transaction or request a refund to your bank account.",
  },
  {
    question: "How does the referral program work?",
    answer: "Share your unique referral code with friends. When they sign up and make their first transaction, you earn a reward bonus credited to your wallet.",
  },
  {
    question: "What networks do you support?",
    answer: "We support all major Nigerian networks including MTN, Glo, Airtel, and 9mobile for airtime and data purchases.",
  },
  {
    question: "Can I buy airtime/data for someone else?",
    answer: "Yes! You can purchase airtime and data for any phone number on any supported network, not just your own.",
  },
  {
    question: "How do I contact customer support?",
    answer: "You can reach us via WhatsApp, email at henry4god99@gmail.com, or through the Support page in the app. Our team responds within 24 hours.",
  },
];

const FAQ = () => {
  return (
    <section id="faq" className="py-16 md:py-24">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Frequently Asked <span className="text-gradient-gold">Questions</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Got questions? We've got answers. Find quick solutions to common queries.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border border-border rounded-xl px-6 data-[state=open]:border-primary/30"
              >
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-medium text-foreground">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
