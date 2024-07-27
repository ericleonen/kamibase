"use client"

import KamiCards from "./components/KamiCards";
import TopBar from "./components/TopBar";

export default function Database() {
	return (
		<div className="h-screen items-center flex-col bg-theme-white overflow-y-scroll">
			<TopBar />
			<KamiCards />
		</div>
  );
}