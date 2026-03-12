'use client'

const SETUP_URL = 'https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server/setup.bat'

export default function SetupPage() {

  async function downloadSetup() {
    try {
      const res = await fetch(SETUP_URL)
      const text = await res.text()
      const blob = new Blob([text], { type: 'application/bat' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'LeVantage-PrintProxy-Setup.bat'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Download failed. Check your internet connection.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">

        {/* Header */}
        <div className="text-5xl mb-4">🖨️</div>
        <h1 className="text-3xl font-bold text-amber-900">Le Vantage</h1>
        <p className="text-amber-700 mb-8">Print Proxy Setup</p>

        {/* Download Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-amber-100 p-8 mb-6">
          <button
            onClick={downloadSetup}
            className="w-full bg-amber-600 text-white px-8 py-5 rounded-2xl font-bold text-xl hover:bg-amber-700 active:bg-amber-800 transition shadow-lg shadow-amber-600/20"
          >
            ⬇️ Download Setup File
          </button>

          <div className="mt-6 text-left space-y-3">
            <p className="text-gray-700 font-medium">After downloading:</p>
            <div className="flex gap-3 items-start">
              <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-sm shrink-0">1</span>
              <span className="text-gray-600">Double-click <strong>LeVantage-PrintProxy-Setup.bat</strong></span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-sm shrink-0">2</span>
              <span className="text-gray-600">Wait for it to finish (says &quot;Setup Complete!&quot;)</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-sm shrink-0">3</span>
              <span className="text-gray-600">Edit <strong>.env</strong> file → paste your Supabase anon key</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-7 h-7 rounded-full bg-green-100 text-green-800 font-bold flex items-center justify-center text-sm shrink-0">✓</span>
              <span className="text-gray-600">Double-click <strong>start.bat</strong> to start printing!</span>
            </div>
          </div>
        </div>

        {/* Requirement note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-6">
          <strong>Requires:</strong> <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="underline">Node.js</a> (install first if not already installed)
        </div>

        {/* Features */}
        <div className="flex justify-center gap-6 text-sm text-gray-500">
          <span>✅ Auto-start</span>
          <span>✅ Auto-update</span>
          <span>✅ All printers</span>
        </div>

      </div>
    </div>
  )
}
