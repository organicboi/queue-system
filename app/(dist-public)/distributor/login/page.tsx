import { DistributorLoginForm } from '@/components/distributor/DistributorLoginForm'

export default function DistributorLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-85">

        <div className="text-center mb-8">
          <svg
            width="32" height="32"
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            className="text-gray-900 mx-auto mb-4"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">
            Distributor Portal
          </h1>
          <p className="text-sm text-gray-500 mt-1">Restricted access</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8">
          <DistributorLoginForm />
        </div>

        <p className="text-center text-[12px] text-gray-400 mt-5">
          Authorized distributors only
        </p>
      </div>
    </div>
  )
}
