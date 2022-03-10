import React from "react";
import { WALLETCONNECT_CTA_TEXT_ID } from "../constants";
import { TextMap } from "../types";

interface PairingDisplayProps {
  text: TextMap;
  pairings: any[];
  onPairingSelected: (pairingTopic: string) => void;
}

function PairingDisplay({ text, pairings, onPairingSelected }: PairingDisplayProps) {
  return (
    <div style={{ height: "45vh" }}>
      <p id={WALLETCONNECT_CTA_TEXT_ID} className="walletconnect-qrcode__text">
        {text.connect_pairing}
      </p>
      {pairings.length
        ? pairings.map((pairing) => (
            <div
              onClick={() => {
                console.log("connecting via pairing: ", pairing.topic);
                onPairingSelected(pairing.topic);
              }}
            >
              {pairing.state.metadata ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    style={{ width: "40px", height: "40px" }}
                    src={pairing.state.metadata.icons[0]}
                    alt={pairing.state.metadata.name}
                  />
                  <div>{pairing.state.metadata.name}</div>
                </div>
              ) : (
                <p>Unknown</p>
              )}
            </div>
          ))
        : text.no_pairings}
    </div>
  );
}

export default PairingDisplay;
