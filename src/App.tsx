import { Core } from "@walletconnect/core";
import {
  Web3Wallet,
  type Web3WalletTypes,
  type IWeb3Wallet,
} from "@walletconnect/web3wallet";
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
  createWalletClient,
  hexToString,
  http,
  type PrivateKeyAccount,
  type WalletClient,
} from "viem";
import { mainnet } from "viem/chains";
import type { SessionTypes } from "@walletconnect/types";

function App() {
  const [web3wallet, setWeb3Wallet] = useState<IWeb3Wallet>();
  const [wallet, setWallet] = useState<WalletClient>();
  const [account, setAccount] = useState<PrivateKeyAccount>();

  const [uri, setUri] = useState<string>();
  const [address, setAddress] = useState<string>();
  const [session, setSession] = useState<SessionTypes.Struct>();

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [requestContent, setRequestContent] = useState({
    method: "",
    message: "",
    topic: "",
    response: {},
  });

  const dialogRef = useRef<HTMLDialogElement>(null);

  const chain = mainnet;

  const generateAccount = () => {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    setAccount(account);

    const client = createWalletClient({
      chain,
      transport: http(),
    });

    setWallet(client);

    setAddress(account.address);
  };

  const init = async () => {
    const core = new Core({
      projectId: import.meta.env.VITE_PROJECT_ID,
    });
    const w3w = await Web3Wallet.init({
      core,
      metadata: {
        name: "W3W Demo",
        description: "Demo Client as Wallet/Peer",
        url: "www.walletconnect.com",
        icons: [],
      },
    });
    setWeb3Wallet(w3w);
  };

  const onSessionProposal = useCallback(
    async ({ id, params }: Web3WalletTypes.SessionProposal) => {
      try {
        if (!address) {
          throw new Error("Address not available");
        }
        const namespaces = {
          proposal: params,
          supportedNamespaces: {
            eip155: {
              chains: [`eip155:${chain.id}`],
              methods: ["eth_sendTransaction", "personal_sign"],
              events: ["accountsChanged", "chainChanged"],
              accounts: [`eip155:${chain.id}:${address}`],
            },
          },
        };

        console.log("namespaces", namespaces);

        const approvedNamespaces = buildApprovedNamespaces(namespaces);

        const session = await web3wallet?.approveSession({
          id,
          namespaces: approvedNamespaces,
        });

        setSession(session);
      } catch (error) {
        await web3wallet?.rejectSession({
          id,
          reason: getSdkError("USER_REJECTED"),
        });
      }
    },
    [address, chain, web3wallet]
  );

  const onAcceptSessionRequest = async () => {
    const { topic, response } = requestContent;
    await web3wallet?.respondSessionRequest({
      topic,
      response: response as {
        id: number;
        jsonrpc: string;
        result: `0x${string}`;
      },
    });
    dialogRef.current?.close();
  };

  const onRejectSessionRequest = async () => {
    const { topic, response } = requestContent;
    const { id } = response as { id: number };
    await web3wallet?.respondSessionRequest({
      topic,
      response: {
        id,
        jsonrpc: "2.0",
        error: {
          code: 5000,
          message: "User rejected.",
        },
      },
    });
    dialogRef.current?.close();
  };

  const onSessionRequest = useCallback(
    async (event: Web3WalletTypes.SessionRequest) => {
      const { topic, params, id } = event;
      const { request } = params;
      const requestParamsMessage = request.params[0];

      const message = hexToString(requestParamsMessage);

      const signedMessage = await wallet?.signMessage({
        account: account as PrivateKeyAccount,
        message,
      });

      setRequestContent({
        message,
        method: request.method,
        topic,
        response: {
          id,
          jsonrpc: "2.0",
          result: signedMessage,
        },
      });

      dialogRef.current?.showModal();
    },
    [account, wallet]
  );

  const pair = async () => {
    if (uri) {
      try {
        console.log("pairing with uri", uri);
        await web3wallet?.pair({ uri });
        setIsConnected(true);
      } catch (e) {
        console.error("Error pairing with uri", e);
      }
    }
  };

  useEffect(() => {
    generateAccount();
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (web3wallet) {
      web3wallet.on("session_proposal", onSessionProposal);
      web3wallet.on("session_request", onSessionRequest);

      const activeSessions = web3wallet?.getActiveSessions();

      if (activeSessions) {
        const currentSession = Object.values(activeSessions)[0];
        setSession(currentSession);
        setIsConnected(Object.keys(activeSessions).length > 0);
      }
    }
  }, [onSessionProposal, onSessionRequest, web3wallet]);

  return (
    <>
      <p>Generated Address: {address}</p>
      <div className="form-container">
        <input
          type="text"
          onChange={(e) => setUri(e.target.value)}
          placeholder="Enter URI"
          className="uri-input"
        />
        <button type="button" onClick={pair}>
          Pair
        </button>
      </div>
      <a
        className="my-1"
        href="https://react-app.walletconnect.com/"
        target="_blank"
        rel="noreferrer noopener"
      >
        Use this to test
      </a>
      {isConnected && (
        <button
          type="button"
          onClick={() => {
            web3wallet?.disconnectSession({
              topic: session?.topic as string,
              reason: {
                code: 5000,
                message: "User disconnected",
              },
            });
            setIsConnected(false);
          }}
        >
          Disconnect Session
        </button>
      )}
      <dialog ref={dialogRef}>
        <h3>
          New approval for <span>{requestContent.method}</span>
        </h3>
        <code>{requestContent.message}</code>
        <div className="btn-container">
          <button type="button" onClick={onAcceptSessionRequest}>
            Accept
          </button>
          <button type="button" onClick={onRejectSessionRequest}>
            Reject
          </button>
        </div>
      </dialog>
    </>
  );
}

export default App;
