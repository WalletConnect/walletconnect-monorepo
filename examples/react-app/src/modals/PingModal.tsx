import * as React from "react";

import Loader from "../components/Loader";
import { SContainer, STable, SRow, SKey, SValue } from "../components/shared";

import { SModalContainer, SModalTitle } from "./shared";

interface PingModalProps {
  pending: boolean;
  result: any;
}

const PingModal = (props: PingModalProps) => {
  const { pending, result } = props;
  return (
    <>
      {pending ? (
        <SModalContainer>
          <SModalTitle>{"Pending Session Ping"}</SModalTitle>
          <SContainer>
            <Loader />
          </SContainer>
        </SModalContainer>
      ) : result ? (
        <SModalContainer>
          <SModalTitle>
            {result.valid ? "Successful Session Ping" : "Failed Session Ping"}
          </SModalTitle>
          <STable>
            {Object.keys(result).map(key => (
              <SRow key={key}>
                <SKey>{key}</SKey>
                <SValue>{result[key].toString()}</SValue>
              </SRow>
            ))}
          </STable>
        </SModalContainer>
      ) : (
        <SModalContainer>
          <SModalTitle>{"Unknown Error with Session Ping"}</SModalTitle>
        </SModalContainer>
      )}
    </>
  );
};

export default PingModal;
