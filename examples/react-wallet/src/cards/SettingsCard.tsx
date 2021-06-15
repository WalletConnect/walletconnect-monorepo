import * as React from "react";
import styled from "styled-components";

import Column from "../components/Column";
import Button from "../components/Button";
import { colors } from "../styles";
import Toggle from "../components/Toggle";

const SWarning = styled.div`
  text-align: justify;
  color: rgb(${colors.red});
`;

const SValue = styled.div`
  font-family: monospace;
  width: 100%;
  font-size: 12px;
  background-color: #eee;
  padding: 8px;
  word-break: break-word;
  border-radius: 8px;
  margin-bottom: 10px;
`;

const SActions = styled.div`
  margin: 0;
  margin-top: 20px;

  display: flex;
  justify-content: space-around;
  & > * {
    margin: 0 5px;
  }
`;

interface SettingsCardProps {
  mnemonic: string;
  testnet: boolean;
  chains: string[];
  toggleTestnets: () => void;
  resetCard: () => void;
}

const SettingsCard = (props: SettingsCardProps) => {
  const { mnemonic, testnet, toggleTestnets, resetCard } = props;

  return (
    <Column>
      <h6>{"Settings"}</h6>
      <SWarning>{`Warning: this wallet was designed for developer purposes only. Browsers are dangerous!!`}</SWarning>
      <SWarning>{`Please make sure you know what you are doing when importing or exporting a mnemonic.`}</SWarning>
      <h6>{"Testnets"}</h6>
      <Toggle active={testnet} onClick={toggleTestnets} />
      <p>{`Toggling this will restart the wallet`}</p>
      <h6>{"Mnemonic"}</h6>
      <SValue>{mnemonic}</SValue>
      <SActions>
        <Button onClick={resetCard}>{`Go Back`}</Button>
      </SActions>
    </Column>
  );
};

export default SettingsCard;
