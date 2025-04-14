import React from "react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";

interface SliderTypesProps {
  small?: boolean;
  title?: string;
}

const SliderTypes: React.FC<SliderTypesProps> = ({
  small = false,
  title = "",
}) => {
  const brands: string[] = [
    "https://cdn.iconscout.com/icon/free/png-512/free-mongodb-logo-icon-download-in-svg-png-gif-file-formats--wordmark-programming-langugae-freebies-pack-logos-icons-1175140.png?f=webp&w=512",
    "https://cdn.iconscout.com/icon/free/png-512/free-postgresql-logo-icon-download-in-svg-png-gif-file-formats--wordmark-programming-langugae-freebies-pack-logos-icons-1175122.png?f=webp&w=512",
    "https://cdn.iconscout.com/icon/free/png-512/free-csv-icon-download-in-svg-png-gif-file-formats--document-extension-format-pack-files-folders-icons-1552247.png?f=webp&w=512",
    "https://cdn.iconscout.com/icon/free/png-512/free-txt-file-icon-download-in-svg-png-gif-formats--format-document-extension-pack-files-folders-icons-504249.png?f=webp&w=512",
    "https://cdn.iconscout.com/icon/free/png-512/free-sqlite-logo-icon-download-in-svg-png-gif-file-formats--company-brand-world-logos-vol-6-pack-icons-282687.png?f=webp&w=512",
    "https://cdn.iconscout.com/icon/free/png-512/free-excel-logo-icon-download-in-svg-png-gif-file-formats--microsoft-window-office-pack-logos-icons-1194336.png?f=webp&w=512",
    "https://cdn.iconscout.com/icon/free/png-512/free-google-adsense-logo-icon-download-in-svg-png-gif-file-formats--brands-pack-logos-icons-189808.png?f=webp&w=512",
    "https://cdn.iconscout.com/icon/free/png-512/free-json-file-icon-download-in-svg-png-gif-formats--format-website-pack-files-folders-icons-504451.png?f=webp&w=512",
    "https://cdn.iconscout.com/icon/free/png-512/free-google-sheets-logo-icon-download-in-svg-png-gif-file-formats--major-websites-set-pack-logos-icons-461802.png?f=webp&w=512",
  ];

  return (
    <section className="w-full py-4 px-6 sm:px-12 lg:px-16 bg-white relative z-10 border-y dark:border-none border-gray-200 dark:bg-gray-900">
      <div className="container mx-auto flex items-center">
        {/* Text label is hidden on very small screens */}
        <span className="hidden sm:flex w-1/6 text-lg my-auto font-semibold text-center border-r pr-4">
          Supported Data Sources
        </span>
        <Swiper
          spaceBetween={8}
          slidesPerView={3}
          breakpoints={{
            640: {
              slidesPerView: 4,
              spaceBetween: 10,
            },
            1024: {
              slidesPerView: 6,
              spaceBetween: 16,
            },
          }}
          autoplay={{
            delay: 3500,
            disableOnInteraction: false,
          }}
          loop={true}
          modules={[Autoplay]}
          className="w-full flex justify-center items-center"
        >
          {brands.map((ele, i) => (
            <SwiperSlide
              key={i}
              className="flex items-center justify-center transition-transform duration-700 hover:scale-105 hover:cursor-pointer"
            >
              <img
                src={ele}
                alt={`Brand ${i + 1}`}
                className="w-8 sm:w-10 md:w-14 lg:w-16 p-2"
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
};

export default SliderTypes;
