export default function FeaturesSection() {
  const features = [
    {
      title: "AI-Powered Dashboards",
      description: "Automatically generate insightful dashboards using cutting-edge AI algorithms tailored to your business needs.",
      area: "tall",
      color: "bg-[#A8DADC] text-[#111827]",
      border: "rounded-tr-[3rem] rounded-bl-[2rem]",
    },
    {
      title: "No-Code Analytics",
      description: "Empower teams to explore and visualize data without writing a single line of code.",
      area: "top1",
      color: "bg-[#A8DADC] text-[#111827]",
      border: "rounded-tl-xl rounded-br-3xl",
    },
    {
      title: "Smart Alerts",
      description: "Receive real-time alerts triggered by anomalies or key business events via email, Slack, and more.",
      area: "top2",
      color: "bg-[#A8DADC] text-[#111827]",
      border: "rounded-t-xl rounded-bl-3xl",
    },
    {
      title: "Data Blending",
      description: "Combine data from Sheets, MySQL, APIs—no complex joins needed.",
      area: "top3",
      color: "bg-[#A8DADC] text-[#111827]",
      border: "rounded-r-2xl rounded-bl-xl",
    },
    {
      title: "Secure Sharing",
      description: "Control access and share dashboards safely with teams or external users.",
      area: "wide",
      color: "bg-[#A8DADC] text-[#111827]",
      border: "rounded-md rounded-bl-[2rem]",
    },
    {
      title: "Custom Branding",
      description: "Match dashboards to your brand: logo, fonts, colors.",
      area: "bottom1",
      color: "bg-[#A8DADC] text-[#111827]",
      border: "rounded-t-2xl rounded-bl-xl",
    },
    {
      title: "Interactive Analysis",
      description: "Enable decision-making with engaging, interactive visuals.",
      area: "bottom2",
      color: "bg-[#A8DADC] text-[#111827]",
      border: "rounded-tr-3xl rounded-bl-lg",
    },
  ];

  return (
    <section className="relative justify-center bg-white dark:bg-black py-16 px-4">
      <div className="relative display-flex py-12 px-4 max-w-7xl mx-auto bg-white dark:bg-[#111827] rounded-2xl">
      <h2 className="relative text-center text-4xl font-bold text-white-800 mb-12">
        Powerful Features
      </h2>

      {/* Responsive Layout (Mobile + Tablet) */}
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:hidden max-w-6xl mx-auto">
        {features.map((feature, i) => {
          const isLast = i === features.length - 1;

          return (
            <div
              key={i}
              className={`p-6 ${feature.color} ${feature.border} shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] rounded-xl flex flex-col justify-between
              ${isLast ? 'col-span-full md:col-span-1 md:col-start-2' : ''}
              `}
            >
             <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
             <p className="text-sm leading-relaxed">{feature.description}</p>
            </div>
          );
       })}
      </div>

      {/* Desktop Layout */}
      <div
        className="hidden lg:grid gap-4 mx-auto max-w-6xl relative"
        style={{
          gridTemplateAreas: `
            "tall top1 top2"
            "tall top3 top3"
            "bottom1 bottom2 wide"
          `,
          gridTemplateColumns: "1fr 1fr 1fr",
          gridAutoRows: "auto", // auto height
        }}
      >
        {features.map((feature, i) => (
          <div
            key={i}
            style={{ gridArea: feature.area }}
            className={`relative overflow-hidden transform transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-2xl hover:z-10 ${feature.color} ${feature.border} p-6 flex flex-col justify-between`}
          >
            <h3 className="relative text-xl font-extrabold mb-2">{feature.title}</h3>
            <p className="relative text-sm leading-relaxed">{feature.description}</p>

            {/* Optional clip-path effect */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="w-full h-full"
              >
                <polygon points="0,0 100,0 100,100 0,100" className="fill-transparent" />
              </svg>
            </div>
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}
