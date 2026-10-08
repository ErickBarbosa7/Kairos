import { useLottie } from "lottie-react";
import animation from "../assets/TenTen Main.json";

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function LoginAnimation() {
  const { View } = useLottie({ animationData: animation, loop: true, autoplay: !reduceMotion() });
  return (
    <div aria-hidden className="mx-auto w-full max-w-60 lg:max-w-72">
      {View}
    </div>
  );
}
