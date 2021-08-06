import * as React from "react";
import styled from "styled-components";
import { SessionTypes } from "@walletconnect/types";

import Column from "../components/Column";
import Button from "../components/Button";
import Peer from "../components/Peer";
import Blockchain from "../components/Blockchain";
import Method from "../components/Method";
import { ChainNamespaces } from "../helpers";

const SActions = styled.div`
  margin: 0;
  margin-top: 20px;

  display: flex;
  justify-content: space-around;
  & > * {
    margin: 0 5px;
  }
`;

interface SessionCardProps {
  chainData: ChainNamespaces;
  session: SessionTypes.Created;
  resetCard: () => void;
  disconnect: (topic: string) => void;
}

const SessionCard = (props: SessionCardProps) => {
  const { chainData, session, resetCard, disconnect } = props;

  const { accounts } = session.state;
  const { methods } = session.permissions.jsonrpc;
  return (
    <Column>
      <h6>{"App"}</h6>
      <Peer metadata={session.peer.metadata} />
      {!!accounts.length ? (
        <React.Fragment>
          <h6>{"Accounts"}</h6>
          {accounts.map(account => {
            const [namespace, reference, address] = account.split(":");
            const chainId = `${namespace}:${reference}`;
            return (
              <Blockchain
                key={`session:account:${account}`}
                chainData={chainData}
                chainId={chainId}
                address={address}
              />
            );
          })}
        </React.Fragment>
      ) : null}
      {!!methods.length ? (
        <React.Fragment>
          <h6>{"Methods"}</h6>
          {methods.map(method => (
            <Method disable key={`session:method:${method}`}>
              <div>{method}</div>
            </Method>
          ))}
        </React.Fragment>
      ) : null}
      <SActions>
        <Button onClick={resetCard}>{`Go Back`}</Button>
        <Button
          color={"red"}
          outline
          onClick={() => disconnect(session.topic)}
        >{`disconnect`}</Button>
      </SActions>
    </Column>
  );
};

export default SessionCard;
