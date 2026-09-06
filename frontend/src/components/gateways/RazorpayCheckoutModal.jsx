import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Smartphone,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowRight,
  QrCode,
  RefreshCw,
  Wallet
} from 'lucide-react';
import Portal from '../ui/Portal';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n ?? 0);

export default function RazorpayCheckoutModal({
  isOpen,
  onClose,
  onSuccess,
  invoice,
  customerName = 'Acme Corp',
  customerEmail = 'billing@dealflow.com',
  customerPhone = '+91 98765 43210'
}) {
  const [selectedMethod, setSelectedMethod] = useState('UPI'); // 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET'
  const [step, setStep] = useState('INSTRUMENT'); // 'INSTRUMENT' | 'OTP' | 'SUCCESS'

  // Card details
  const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [cardName, setCardName] = useState('Acme Finance Desk');

  // UPI details
  const [upiId, setUpiId] = useState('acme@okhdfcbank');
  const [upiMode, setUpiMode] = useState('QR'); // 'QR' | 'VPA'

  // Netbanking details
  const [selectedBank, setSelectedBank] = useState('HDFC');

  // OTP details
  const [otp, setOtp] = useState('123456');
  const [processing, setProcessing] = useState(false);
  const [generatedPayId, setGeneratedPayId] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('INSTRUMENT');
      setProcessing(false);
      setGeneratedPayId(`pay_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 6)}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartPayment = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      if (selectedMethod === 'CARD' || selectedMethod === 'NETBANKING') {
        setStep('OTP');
      } else {
        // UPI instant approval simulation
        handleCompletePayment();
      }
    }, 900);
  };

  const handleCompletePayment = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setStep('SUCCESS');
      setTimeout(() => {
        onSuccess({
          razorpay_payment_id: generatedPayId,
          razorpay_order_id: `order_${Math.random().toString(36).substring(2, 12)}`,
          razorpay_signature: `sig_${Math.random().toString(36).substring(2, 16)}`,
          method: selectedMethod,
        });
      }, 1200);
    }, 1000);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[430px] rounded-2xl bg-white text-slate-900 shadow-2xl overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200 flex flex-col font-sans">
        
        {/* ── Official Razorpay Header ────────────────────────────────────────── */}
        <div className="bg-[#0c2340] text-white p-4 sm:p-5 relative">
          {/* Official Test Mode Banner */}
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black tracking-wider uppercase shadow-sm">
              <span>●</span> Razorpay Test Mode
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-white/10 px-2 py-0.5 rounded">
              rzp_test_TYSSO3qiz67Ke3
            </span>
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-blue-500 text-white font-black text-xs flex items-center justify-center shadow">
                  R
                </div>
                <h3 className="font-bold text-sm tracking-tight text-white">DealFlow360 Tech</h3>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">Invoice #{invoice?.invoice_number}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Amount to Pay</span>
              <p className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                {formatINR(invoice?.amount)}
              </p>
            </div>
          </div>
        </div>

        {/* ── User Contact Bar ────────────────────────────────────────────── */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-600">
          <div className="truncate pr-2">
            <span className="font-semibold text-slate-800">{customerName}</span>
            <span className="text-slate-400 mx-1.5">•</span>
            <span className="text-slate-500">{customerPhone}</span>
          </div>
          <span className="text-[11px] text-blue-600 font-medium">Standard</span>
        </div>

        {/* ── Modal Content based on step ─────────────────────────────────── */}
        {step === 'INSTRUMENT' && (
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
            {/* Method Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {[
                { id: 'UPI', label: 'UPI / QR', icon: Smartphone },
                { id: 'CARD', label: 'Card', icon: CreditCard },
                { id: 'NETBANKING', label: 'NetBanking', icon: Landmark },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = selectedMethod === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedMethod(tab.id)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
                    }`}
                  >
                    <Icon size={16} className="mb-0.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Instrument View: UPI */}
            {selectedMethod === 'UPI' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUpiMode('QR')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all text-center ${
                      upiMode === 'QR'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Scan QR Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpiMode('VPA')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all text-center ${
                      upiMode === 'VPA'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Enter UPI ID
                  </button>
                </div>

                {upiMode === 'QR' ? (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center text-center space-y-2">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-inner">
                      <QrCode size={110} className="text-slate-900" />
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      Scan with Google Pay, PhonePe, Paytm or BHIM
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono">
                      VPA: {localStorage.getItem('dealflow_billing_upi_id') || 'dealflow.billing@hdfcbank'}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Virtual Payment Address (VPA)
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. yourname@okhdfcbank"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex gap-1.5 pt-1">
                      {['@okhdfcbank', '@paytm', '@ybl', '@okaxis'].map((handle) => (
                        <button
                          key={handle}
                          type="button"
                          onClick={() => setUpiId(`acme${handle}`)}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-600 font-mono"
                        >
                          {handle}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instrument View: CARD */}
            {selectedMethod === 'CARD' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
                  <span className="text-blue-800 font-semibold">Razorpay Test Card (Auto-filled)</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-200/60 text-blue-900 text-[10px] font-bold">VISA</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Expiry (MM/YY)</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">CVV</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cardholder Name</label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Instrument View: NETBANKING */}
            {selectedMethod === 'NETBANKING' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <p className="text-xs font-semibold text-slate-700">Popular Banks</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'HDFC', name: 'HDFC Bank', color: 'border-blue-500 text-blue-900 bg-blue-50' },
                    { id: 'SBI', name: 'State Bank of India', color: 'border-sky-500 text-sky-900 bg-sky-50' },
                    { id: 'ICICI', name: 'ICICI Bank', color: 'border-orange-500 text-orange-900 bg-orange-50' },
                    { id: 'AXIS', name: 'Axis Bank', color: 'border-rose-500 text-rose-900 bg-rose-50' },
                  ].map((bank) => (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => setSelectedBank(bank.id)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                        selectedBank === bank.id
                          ? `${bank.color} ring-2 ring-blue-500 shadow-sm font-bold`
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {bank.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pay Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={processing}
                onClick={handleStartPayment}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                {processing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Connecting to Bank Gateway...</span>
                  </>
                ) : (
                  <>
                    <span>Pay {formatINR(invoice?.amount)}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Official Bank OTP 3D-Secure Simulation ───────────────── */}
        {step === 'OTP' && (
          <div className="p-5 flex-1 space-y-4 animate-in fade-in duration-200">
            <div className="text-center space-y-1 pb-3 border-b border-slate-200">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 mb-1">
                <ShieldCheck size={14} />
                3D Secure Verification
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                {selectedMethod === 'CARD' ? 'Visa / Mastercard SafePay' : `${selectedBank} Bank NetBanking Portal`}
              </h4>
              <p className="text-[11px] text-slate-500">
                An OTP was sent to mobile ending in <strong className="text-slate-800">**210</strong>
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-3">
              <span className="text-xs font-semibold text-slate-700 block">Enter One-Time Password (OTP)</span>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-48 mx-auto text-center tracking-[0.4em] font-mono text-lg font-black text-slate-900 bg-white border-2 border-blue-500 rounded-lg p-2 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400">
                (Test Simulation: Pre-filled with standard test OTP <code className="font-bold text-slate-600">123456</code>)
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={processing}
                onClick={handleCompletePayment}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {processing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Verifying OTP & Authorizing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Submit & Authorize {formatINR(invoice?.amount)}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('INSTRUMENT')}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Cancel / Choose Another Method
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Payment Success Screen ──────────────────────────────── */}
        {step === 'SUCCESS' && (
          <div className="p-6 flex-1 flex flex-col items-center justify-center text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce shadow-lg">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900">Payment Successful!</h3>
            <p className="text-xs text-slate-500 max-w-xs">
              Razorpay transaction authorized for <span className="font-semibold text-slate-800">{customerName}</span>.
            </p>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 text-left font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Payment ID:</span>
                <span className="font-bold text-blue-600">{generatedPayId}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Amount:</span>
                <span className="font-bold text-emerald-600">{formatINR(invoice?.amount)}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-500" /> Settle verification transmitted to DealFlow360
            </p>
          </div>
        )}

        {/* ── Official Razorpay Footer ────────────────────────────────────── */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Lock size={11} className="text-slate-400" />
            256-bit SSL Encryption
          </span>
          <div className="flex items-center gap-1 font-semibold text-slate-700">
            <span>Powered by</span>
            <span className="font-black text-blue-700 tracking-tight">Razorpay</span>
          </div>
        </div>
      </div>
      </div>
    </Portal>
  );
}
