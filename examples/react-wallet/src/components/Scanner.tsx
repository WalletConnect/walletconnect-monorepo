import * as React from "react";
import styled from "styled-components";
import QrReader from "react-qr-reader";

const SScannerContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  margin: 0 auto !important;
  background: rgb(0, 0, 0);
`;

const SScannerWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const SCloseButton = styled.div`
  transition: all 0.2s ease-in-out;
  width: 25px;
  height: 25px;
  position: absolute;
  z-index: 10;
  top: 15px;
  right: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(45deg);
  &:hover {
    opacity: 0.5;
  }
`;

const SFirstLine = styled.div`
  position: absolute;
  width: 90%;
  border: 1px solid rgb(255, 255, 255);
`;

const SSecondLine = styled(SFirstLine as any)`
  transform: rotate(90deg);
`;

export interface ScannerValidation {
  error: Error | null;
  result: any | null;
}

interface ScannerProps {
  onValidate: (data: string) => ScannerValidation;
  onScan: (data: any) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

interface ScannerState {
  delay: number | false;
}

class Scanner extends React.Component<ScannerProps, ScannerState> {
  public state = {
    delay: 300,
  };

  public stopRecording = async () => {
    await this.setState({ delay: false });
  };

  public handleScan = (data: string | null) => {
    if (data) {
      const { result, error } = this.props.onValidate(data);
      if (result) {
        this.stopRecording();
        this.props.onScan(result);
      } else {
        this.handleError(error);
      }
    }
  };

  public handleError = (error: Error | null) => {
    if (error) {
      this.props.onError(error);
    }
  };

  public onClose = async () => {
    try {
      await this.stopRecording();
      this.props.onClose();
    } catch (e) {
      this.handleError(e as any);
    }
  };

  public componentWillUnmount() {
    this.stopRecording();
  }
  public render() {
    return (
      <SScannerContainer>
        <SCloseButton onClick={this.onClose}>
          <SFirstLine />
          <SSecondLine />
        </SCloseButton>
        <SScannerWrapper>
          <QrReader
            delay={this.state.delay}
            onError={this.handleError}
            onScan={this.handleScan}
            style={{ width: "100%" }}
          />
        </SScannerWrapper>
      </SScannerContainer>
    );
  }
}

export default Scanner;
