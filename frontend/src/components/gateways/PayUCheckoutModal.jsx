import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Smartphone,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  QrCode
} from 'lucide-react';
import Portal from '../ui/Portal';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n ?? 0);

export default function PayUCheckoutModal({
  isOpen,
  onClose,
  onSuccess,
  invoice,
  customerName = 'Acme Corp',
  customerEmail = 'billing@dealflow.com',
  customerPhone = '+91 98765 43210'
}) {
  const [selectedMethod, setSelectedMethod] = useState('CARD'); // 'CARD' | 'NETBANKING' | 'UPI'
  const [step, setStep] = useState('INSTRUMENT'); // 'INSTRUMENT' | 'OTP' | 'SUCCESS'

  // Card details
  const [cardNumber, setCardNumber] = useState('5123 4567 8901 2345');
  const [cardExpiry, setCardExpiry] = useState('09/29');
  const [cardCvv, setCardCvv] = useState('456');
  const [cardName, setCardName] = useState('Acme Corporation');

  // Netbanking details
  const [selectedBank, setSelectedBank] = useState('HDFC');

  // UPI details
  const [upiId, setUpiId] = useState('acme@upi');

  // OTP details
  const [otp, setOtp] = useState('123456');
  const [processing, setProcessing] = useState(false);
  const [generatedTxnId, setGeneratedTxnId] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('INSTRUMENT');
      setProcessing(false);
      setGeneratedTxnId(`payu_${Math.random().toString(36).substring(2, 12)}`);
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
        handleCompletePayment();
      }
    }, 850);
  };

  const handleCompletePayment = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setStep('SUCCESS');
      setTimeout(() => {
        onSuccess({
          txnid: generatedTxnId,
          mihpayid: `mih_${Math.random().toString(36).substring(2, 10)}`,
          status: 'success',
          method: selectedMethod,
        });
      }, 1200);
    }, 950);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[440px] rounded-2xl bg-white text-slate-900 shadow-2xl overflow-hidden border border-slate-300 animate-in zoom-in-95 duration-200 flex flex-col font-sans">
        
        {/* ── Official PayU Header ────────────────────────────────────────────── */}
        <div className="bg-[#0f2c31] text-white p-4 sm:p-5 relative border-b-2 border-[#a4d233]">
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#a4d233] text-[#0f2c31] text-[10px] font-black tracking-wider uppercase shadow-sm">
              <span>●</span> PayU Test Sandbox
            </div>
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded bg-[#a4d233] text-[#0f2c31] font-black text-xs tracking-tighter shadow">
                  PayU
                </div>
                <h3 className="font-bold text-sm tracking-tight text-white">DealFlow360 Merchant</h3>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 font-mono">INV: {invoice?.invoice_number}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">Total Payable</span>
              <p className="text-xl font-black text-[#a4d233] font-mono mt-0.5">
                {formatINR(invoice?.amount)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Contact Bar ────────────────────────────────────────────────────── */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-600">
          <div className="truncate pr-2">
            <span className="font-semibold text-slate-800">{customerName}</span>
            <span className="text-slate-400 mx-1.5">•</span>
            <span className="text-slate-500">{customerPhone}</span>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">PayU Biz</span>
        </div>

        {/* ── Content: Step 1 (Instrument Selection) ─────────────────────────── */}
        {step === 'INSTRUMENT' && (
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
            {/* Method Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {[
                { id: 'CARD', label: 'Cards', icon: CreditCard },
                { id: 'NETBANKING', label: 'NetBanking', icon: Landmark },
                { id: 'UPI', label: 'PayU UPI', icon: Smartphone },
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
                        ? 'bg-white text-[#0f2c31] shadow-sm border border-slate-200 font-bold'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
                    }`}
                  >
                    <Icon size={16} className={`mb-0.5 ${active ? 'text-[#53a318]' : ''}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* CARD */}
            {selectedMethod === 'CARD' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                  <span className="text-emerald-900 font-semibold">PayU Test Card Auto-Configured</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 text-[10px] font-bold">MASTERCARD</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Expiry (MM/YY)</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">CVV</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Name on Card</label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* NETBANKING */}
            {selectedMethod === 'NETBANKING' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <p className="text-xs font-semibold text-slate-700">Select NetBanking Channel</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'HDFC', name: 'HDFC Bank', color: 'border-blue-500 bg-blue-50 text-blue-900' },
                    { id: 'ICICI', name: 'ICICI Bank', color: 'border-orange-500 bg-orange-50 text-orange-900' },
                    { id: 'SBI', name: 'State Bank of India', color: 'border-sky-500 bg-sky-50 text-sky-900' },
                    { id: 'AXIS', name: 'Axis Bank', color: 'border-rose-500 bg-rose-50 text-rose-900' },
                  ].map((bank) => (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => setSelectedBank(bank.id)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                        selectedBank === bank.id
                          ? `${bank.color} ring-2 ring-emerald-500 shadow-sm font-bold`
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {bank.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* UPI */}
            {selectedMethod === 'UPI' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <QrCode size={40} className="text-slate-800" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">PayU UPI Intent & Collect</h5>
                    <p className="text-[11px] text-slate-500">Supports all major UPI client applications</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Enter UPI VPA ID</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Pay Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={processing}
                onClick={handleStartPayment}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#0f2c31] hover:bg-[#163e46] disabled:opacity-60 text-white text-sm font-bold shadow-lg shadow-emerald-950/20 transition-all cursor-pointer border border-[#a4d233]/40"
              >
                {processing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin text-[#a4d233]" />
                    <span>Contacting PayU Gateway...</span>
                  </>
                ) : (
                  <>
                    <span>Pay {formatINR(invoice?.amount)} via PayU</span>
                    <ArrowRight size={16} className="text-[#a4d233]" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Content: Step 2 (Bank 3D-Secure Simulation) ────────────────────── */}
        {step === 'OTP' && (
          <div className="p-5 flex-1 space-y-4 animate-in fade-in duration-200">
            <div className="text-center space-y-1 pb-3 border-b border-slate-200">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-1">
                <ShieldCheck size={14} className="text-[#53a318]" />
                PayU 3D Secure Authentication
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                {selectedMethod === 'CARD' ? 'Mastercard Identity Check / Visa Secure' : `${selectedBank} Bank Auth Portal`}
              </h4>
              <p className="text-[11px] text-slate-500">
                OTP sent to registered mobile ending in <strong className="text-slate-800">**210</strong>
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-3">
              <span className="text-xs font-semibold text-slate-700 block">Enter One-Time Password (OTP)</span>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-48 mx-auto text-center tracking-[0.4em] font-mono text-lg font-black text-slate-900 bg-white border-2 border-emerald-600 rounded-lg p-2 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400">
                (PayU Simulation: Pre-filled with test OTP <code className="font-bold text-slate-600">123456</code>)
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
                    <span>Confirming with PayU...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Authorize Payment of {formatINR(invoice?.amount)}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('INSTRUMENT')}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Cancel / Return to Payment Methods
              </button>
            </div>
          </div>
        )}

        {/* ── Content: Step 3 (Success) ──────────────────────────────────────── */}
        {step === 'SUCCESS' && (
          <div className="p-6 flex-1 flex flex-col items-center justify-center text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce shadow-lg">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900">PayU Transaction Approved!</h3>
            <p className="text-xs text-slate-500 max-w-xs">
              Transaction successfully confirmed by PayU India for <span className="font-semibold text-slate-800">{customerName}</span>.
            </p>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 text-left font-mono">
              <div className="flex justify-between text-slate-600">
                <span>PayU Txn ID:</span>
                <span className="font-bold text-emerald-700">{generatedTxnId}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Amount:</span>
                <span className="font-bold text-emerald-600">{formatINR(invoice?.amount)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Official PayU Footer ────────────────────────────────────────────── */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Lock size={11} className="text-slate-400" />
            PCI-DSS 3.2.1 Certified
          </span>
          <div className="flex items-center gap-1 font-semibold text-slate-700">
            <span>Powered by</span>
            <span className="font-black text-[#0f2c31] tracking-tight">Pay<span className="text-[#53a318]">U</span></span>
          </div>
        </div>
      </div>
      </div>
    </Portal>
  );
}
