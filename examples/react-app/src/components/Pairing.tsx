import * as React from "react";
import styled from "styled-components";

import { PairingTypes } from "@walletconnect/types";

import { SRow, SKey, SValue } from "./shared";
import { colors, fonts } from "../styles";

interface PairingProps {
  pairing: PairingTypes.Settled;
  onClick?: any;
}

const SPairingContainer = styled.div`
  width: 100%;
  border: 2px solid rgb(${colors.dark});
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
`;

const SPairingTopic = styled.div`
  font-size: ${fonts.size.tiny};
`;

const Pairing = (props: PairingProps) => {
  const {
    topic,
    peer: { metadata },
  } = props.pairing;
  return (
    <SPairingContainer onClick={props.onClick}>
      <SPairingTopic>{topic}</SPairingTopic>
      <div>
        {typeof metadata !== "undefined" ? (
          Object.keys(metadata).map(key => (
            <SRow key={`${topic}:metadata:${key}`}>
              <SKey>{key}</SKey>
              <SValue>{(metadata as any)[key]}</SValue>
            </SRow>
          ))
        ) : (
          <div>{`Unknown`}</div>
        )}
      </div>
    </SPairingContainer>
  );
};

export default Pairing;
