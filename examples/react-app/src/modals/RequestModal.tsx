import * as React from "react";

import Loader from "../components/Loader";

import {
  SModalContainer,
  SModalTitle,
  SModalParagraph,
  SContainer,
  STable,
  SRow,
  SKey,
  SValue,
} from "./shared";

interface RequestModalProps {
  pending: boolean;
  result: any;
}

const RequestModal = (props: RequestModalProps) => {
  const { pending, result } = props;
  return (
    <>
      {pending ? (
        <SModalContainer>
          <SModalTitle>{"Pending Call Request"}</SModalTitle>
          <SContainer>
            <Loader />
            <SModalParagraph>{"Approve or reject request using your wallet"}</SModalParagraph>
          </SContainer>
        </SModalContainer>
      ) : result ? (
        <SModalContainer>
          <SModalTitle>
            {result.valid ? "Call Request Approved" : "Call Request Failed"}
          </SModalTitle>
          <STable>
            {Object.keys(result).map((key) => (
              <SRow key={key}>
                <SKey>{key}</SKey>
                <SValue>{result[key].toString()}</SValue>
              </SRow>
            ))}
          </STable>
        </SModalContainer>
      ) : (
        <SModalContainer>
          <SModalTitle>{"Call Request Rejected"}</SModalTitle>
        </SModalContainer>
      )}
    </>
  );
};

export default RequestModal;
