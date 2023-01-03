import React from "react";

interface ConnectDcentButtonProps {
    name: string;
    // color: string;
    dynamicLink: string;
    onClick: () => void;
}
const ConnectDcentButton = (props: ConnectDcentButtonProps) => {

    return (
            <a
                className="dcent-walletconnect-connect__button"
                href={props.dynamicLink}
                target="_blank"
                onClick={props.onClick}
            >
                {props.name}

            </a>
    );

};
export default ConnectDcentButton;