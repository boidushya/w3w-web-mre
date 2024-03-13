import { Core } from "@walletconnect/core";
import { Web3Wallet, type Web3WalletTypes } from "@walletconnect/web3wallet";
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

function App() {
  // biome-ignore lint/suspicious/noExplicitAny: This is a demo app
  const [web3wallet, setWeb3Wallet] = useState<any>();
  const [uri, setUri] = useState<string>();
  const [address, setAddress] = useState<string>();
  const [session, setSession] = useState<Web3WalletTypes.SessionRequest>();
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const generateAccount = () => {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    setAddress(account.address);
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
              chains: ["eip155:1"],
              methods: ["eth_sendTransaction", "personal_sign"],
              events: ["accountsChanged", "chainChanged"],
              accounts: [`eip155:1:${address}`],
            },
          },
        };

        console.log("namespaces", namespaces);

        const approvedNamespaces = buildApprovedNamespaces(namespaces);

        const session = await web3wallet.approveSession({
          id,
          namespaces: approvedNamespaces,
        });

        setSession(session);
      } catch (error) {
        await web3wallet.rejectSession({
          id,
          reason: getSdkError("USER_REJECTED"),
        });
      }
    },
    [address, web3wallet]
  );

  const pair = async () => {
    if (uri) {
      try {
        console.log("pairing with uri", uri);
        await web3wallet.pair({ uri });
        setIsConnected(true);
      } catch (e) {
        console.error("Error pairing with uri", e);
      }
    }
  };

  useEffect(() => {
    generateAccount();

    const init = async () => {
      const core = new Core({
        projectId: import.meta.env.VITE_PROJECT_ID,
      });
      const w3w = await Web3Wallet.init({
        core, // <- pass the shared `core` instance
        metadata: {
          name: "Demo app",
          description: "Demo Client as Wallet/Peer",
          url: "www.walletconnect.com",
          icons: [],
        },
      });
      setWeb3Wallet(w3w);
    };
    init();
  }, []);

  useEffect(() => {
    if (web3wallet) {
      web3wallet.on("session_proposal", onSessionProposal);
      const activeSessions = web3wallet?.getActiveSessions();
      console.log(activeSessions);
      if (activeSessions) {
        const currentSession = Object.values(
          activeSessions
        )[0] as Web3WalletTypes.SessionRequest;
        setSession(currentSession);
        setIsConnected(Object.keys(activeSessions).length > 0);
      }
    }
  }, [onSessionProposal, web3wallet]);

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
        href="https://react-app.walletconnect.com/"
        target="_blank"
        rel="noreferrer noopener"
      >
        Use this to test
      </a>
      {isConnected && (
        <div>
          <p>Connected</p>
          <button
            type="button"
            onClick={() =>
              web3wallet?.disconnectSession({
                topic: session?.topic,
                reason: "User disconnected",
              })
            }
          >
            Kill Session
          </button>
        </div>
      )}
    </>
  );
}

export default App;
