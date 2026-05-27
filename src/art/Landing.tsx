import { Link } from 'react-router-dom';
import { Palette, Moon, ArrowRight } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-dvh bg-app-bg flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            Apps
          </h1>
          <p className="text-gray-600 mt-2">Pick a tool to launch.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            to="/art"
            className="card p-6 hover:shadow-md transition-shadow group flex flex-col gap-3"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white">
              <Palette className="w-6 h-6" />
            </div>
            <h2 className="font-bold text-lg">Art Pipeline</h2>
            <p className="text-sm text-gray-600 flex-1">
              <strong>Artist Studio</strong> generates fresh art from prompts, style refs
              and LoRAs. <strong>Reskin Studio</strong> rethemes a whole folder of game
              assets in batch. <strong>Animate</strong> turns stills into video clips.
            </p>
            <span className="text-primary-600 font-semibold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              Open <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
          <Link
            to="/sleep"
            className="card p-6 hover:shadow-md transition-shadow group flex flex-col gap-3"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white">
              <Moon className="w-6 h-6" />
            </div>
            <h2 className="font-bold text-lg">Baby Sleep Tracker</h2>
            <p className="text-sm text-gray-600 flex-1">
              Existing PWA for tracking naps and night sleep.
            </p>
            <span className="text-primary-600 font-semibold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              Open <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
        <div className="text-center text-xs text-gray-500">
          Static site hosted on GitHub Pages. Calls AI providers directly from your browser.
        </div>
      </div>
    </div>
  );
}
