export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Marketing Automation Platform</h1>
      <p className="mt-4 text-lg text-gray-600">Automate your marketing campaigns with ease</p>
      <div className="mt-8 space-x-4">
        <a href="/login" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Login
        </a>
        <a href="/register" className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
          Register
        </a>
      </div>
    </main>
  )
}