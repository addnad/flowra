"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { FlowraLogo } from "@/components/ui/logo";
import { USDC_ADDRESS } from "@/lib/wagmi";

const AnimatedNavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="group relative inline-block overflow-hidden h-5 flex items-center text-sm">
    <div className="flex flex-col transition-transform duration-300 ease-out group-hover:-translate-y-1/2">
      <span className="text-gray-300">{children}</span>
      <span className="text-white">{children}</span>
    </div>
  </a>
);

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [headerShapeClass, setHeaderShapeClass] = useState("rounded-full");
  const shapeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walletDropdownRef = useRef<HTMLDivElement>(null);

  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: usdcBalance } = useBalance({ address, token: USDC_ADDRESS as `0x${string}` });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(e.target as Node)) {
        setWalletOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current);
    if (isOpen) {
      setHeaderShapeClass("rounded-xl");
    } else {
      shapeTimeoutRef.current = setTimeout(() => setHeaderShapeClass("rounded-full"), 300);
    }
    return () => { if (shapeTimeoutRef.current) clearTimeout(shapeTimeoutRef.current); };
  }, [isOpen]);

  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  const navLinks = [
    { label: "Dashboard",    href: "/dashboard" },
    { label: "Send",         href: "/create"    },
    { label: "How it Works", href: "/#how"      },
    { label: "Analytics",    href: "/analytics" },
  ];

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
      <header
        className={`transition-all duration-300 ${headerShapeClass} bg-[rgba(10,10,10,0.85)] backdrop-blur-md border border-white/10 shadow-lg`}
        style={{ minWidth: "320px", maxWidth: "720px", width: "100%" }}
      >
        <div className="flex items-center justify-between px-5 py-3 gap-4">
          <a href="/" className="flex items-center gap-2 shrink-0">
            <FlowraLogo size={28} />
            <span className="text-white font-semibold text-sm tracking-tight">Flowra</span>
          </a>

          <nav className="hidden sm:flex items-center gap-6">
            {navLinks.map((l) => (
              <AnimatedNavLink key={l.href} href={l.href}>{l.label}</AnimatedNavLink>
            ))}
          </nav>

          <div className="hidden sm:block relative" ref={walletDropdownRef}>
            {isConnected ? (
              <div>
                <button
                  onClick={() => setWalletOpen(!walletOpen)}
                  className="px-4 py-1.5 text-xs border border-white/20 bg-white/5 text-gray-300 rounded-full hover:border-white/40 hover:text-white transition-colors flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  {shortAddress}
                </button>
                {walletOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-gray-500 text-xs mb-1">USDC Balance</p>
                      <p className="text-white text-sm font-bold">
                        {usdcBalance ? `$${parseFloat(usdcBalance.formatted).toFixed(2)}` : "—"}
                      </p>
                    </div>
                      <a
                      href="https://faucet.circle.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-3 text-xs text-blue-400 hover:bg-white/5 transition-colors border-b border-white/10"
                      onClick={() => setWalletOpen(false)}
                    >
                      <span>💧</span> Get Testnet USDC
                    </a>
                    <button
                      onClick={() => { disconnect(); setWalletOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-xs text-red-400 hover:bg-white/5 transition-colors text-left"
                    >
                      <span>⏏</span> Disconnect
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => connect({ connector: connectors[0] })}
                className="relative px-4 py-1.5 text-xs font-medium text-white rounded-full bg-gradient-to-r from-blue-500 to-violet-500 hover:opacity-90 transition-opacity"
              >
                Connect Wallet
              </button>
            )}
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="sm:hidden flex flex-col gap-1 p-1"
          >
            <span className={`block w-5 h-px bg-gray-300 transition-transform duration-300 ${isOpen ? "rotate-45 translate-y-1.5" : ""}`} />
            <span className={`block w-5 h-px bg-gray-300 transition-opacity duration-300 ${isOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-px bg-gray-300 transition-transform duration-300 ${isOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
          </button>
        </div>

        <div className={`sm:hidden overflow-hidden transition-all duration-300 ${isOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="border-t border-white/10 px-5 py-4 flex flex-col gap-4">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setIsOpen(false)}>
                {l.label}
              </a>
            ))}
            <div className="pt-2 border-t border-white/10 space-y-2">
              {isConnected ? (
                <>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-gray-500 text-xs">USDC Balance</span>
                    <span className="text-white text-xs font-bold">
                      {usdcBalance ? `$${parseFloat(usdcBalance.formatted).toFixed(2)}` : "—"}
                    </span>
                  </div>
                    <a
                    href="https://faucet.circle.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-blue-400 px-1"
                    onClick={() => setIsOpen(false)}
                  >
                    💧 Get Testnet USDC
                  </a>
                  <button
                    onClick={() => { disconnect(); setIsOpen(false); }}
                    className="w-full px-4 py-2 text-xs border border-red-500/20 text-red-400 rounded-full text-left"
                  >
                    ⏏ Disconnect ({shortAddress})
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { connect({ connector: connectors[0] }); setIsOpen(false); }}
                  className="w-full px-4 py-2 text-xs text-white rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
