import { Suspense } from "react";
import KamiCards, { KamiCardsSkeleton } from "./components/KamiCards";
import TopBar from "./components/TopBar";

export default function Database() {
	return (
		<div className="h-screen items-center flex flex-col bg-theme-white overflow-y-hidden">
			<TopBar />
			<div
				className="h-[100vh-5rem] flex flex-wrap w-full p-3 overflow-y-scroll"
			>
				<Suspense fallback={<KamiCardsSkeleton />}>
					<KamiCards />
				</Suspense>
			</div>
		</div>
  );
}