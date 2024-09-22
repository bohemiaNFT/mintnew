        import {
          PublicKey,
          publicKey,
          Umi,
        } from "@metaplex-foundation/umi";
        import { DigitalAssetWithToken, JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
        import dynamic from "next/dynamic";
        import { Dispatch, SetStateAction, useEffect, useMemo, useState, useCallback } from "react";
        import { useUmi } from "../utils/useUmi";
        import { fetchCandyMachine, safeFetchCandyGuard, CandyGuard, CandyMachine } from "@metaplex-foundation/mpl-core-candy-machine"
        import styles from "../styles/Home.module.css";
        import { guardChecker } from "../utils/checkAllowed";
        import { Center, Card, CardHeader, CardBody, StackDivider, Heading, Stack, useToast, Text, Skeleton, useDisclosure, Button, Modal, ModalBody, ModalCloseButton, ModalContent, Image, ModalHeader, ModalOverlay, Box, Divider, VStack, Flex, Progress } from '@chakra-ui/react';
        import { ButtonList } from "../components/mintButton";
        import { DasApiAssetAndAssetMintLimit, GuardReturn } from "../utils/checkerHelper";
        import { ShowNft } from "../components/showNft";
        import { InitializeModal } from "../components/initializeModal";
        import { image, headerText, workimage } from "../settings";
        import { useSolanaTime } from "@/utils/SolanaTimeContext";
        import { useRouter } from 'next/router';
        import { useWalletBalance } from '../utils/useWalletBalance';
        import { useWallet } from '@solana/wallet-adapter-react';
        import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
        import { SolAmount } from '@metaplex-foundation/umi';

        const WalletMultiButtonDynamic = dynamic(
          async () =>
            (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
          { ssr: false }
        );

        const useCandyMachine = (
          umi: Umi,
          candyMachineId: string,
          checkEligibility: boolean,
          setCheckEligibility: Dispatch<SetStateAction<boolean>>,
          firstRun: boolean,
          setfirstRun: Dispatch<SetStateAction<boolean>>
        ) => {
          const [candyMachine, setCandyMachine] = useState<CandyMachine>();
          const [candyGuard, setCandyGuard] = useState<CandyGuard>();
          const [mintPrice, setMintPrice] = useState<number | null>(null);
          const toast = useToast();

          useEffect(() => {
            (async () => {
              if (checkEligibility) {
                if (!candyMachineId) {
                  console.error("No candy machine in .env!");
                  if (!toast.isActive("no-cm")) {
                    toast({
                      id: "no-cm",
                      title: "No candy machine in .env!",
                      description: "Add your candy machine address to the .env file!",
                      status: "error",
                      duration: 999999,
                      isClosable: true,
                    });
                  }
                  return;
                }

                let candyMachine;
                try {
                  candyMachine = await fetchCandyMachine(umi, publicKey(candyMachineId));
                } catch (e) {
                  console.error(e);
                  toast({
                    id: "no-cm-found",
                    title: "The CM from .env is invalid",
                    description: "Are you using the correct environment?",
                    status: "error",
                    duration: 999999,
                    isClosable: true,
                  });
                }
                setCandyMachine(candyMachine);
                if (!candyMachine) {
                  return;
                }
                let candyGuard;
                try {
                  candyGuard = await safeFetchCandyGuard(umi, candyMachine.mintAuthority);
                } catch (e) {
                  console.error(e);
                  toast({
                    id: "no-guard-found",
                    title: "No Candy Guard found!",
                    description: "Do you have one assigned?",
                    status: "error",
                    duration: 999999,
                    isClosable: true,
                  });
                }
                if (!candyGuard) {
                  return;
                }
                setCandyGuard(candyGuard);

                if (candyMachine && candyGuard) {
                  // Fetch mint price from candy machine or guard
                  const solPayment = candyGuard.guards.solPayment;
                  const price = solPayment && 'lamports' in solPayment
                    ? Number(solPayment.lamports) / 1e9
                    : 0;
                  setMintPrice(price);
                }

                if (firstRun){
                  setfirstRun(false)
                }
              }
            })();
          }, [umi, checkEligibility, candyMachineId, firstRun, setfirstRun, toast]);

          return { candyMachine, setCandyMachine, candyGuard, mintPrice };
        };

        export default function Home() {
          const umi = useUmi();
          const solanaTime = useSolanaTime(); 
          const toast = useToast();
          const { isOpen: isShowNftOpen, onOpen: onShowNftOpen, onClose: onShowNftClose } = useDisclosure();
          const { isOpen: isInitializerOpen, onOpen: onInitializerOpen, onClose: onInitializerClose } = useDisclosure();
          const [mintsCreated, setMintsCreated] = useState<{ mint: PublicKey, offChainMetadata: JsonMetadata | undefined }[] | undefined>();
          const [isAllowed, setIsAllowed] = useState<boolean>(false);
          const [loading, setLoading] = useState(true);
          const [ownedTokens, setOwnedTokens] = useState<DigitalAssetWithToken[]>();
          const [ownedCoreAssets, setOwnedCoreAssets] = useState<DasApiAssetAndAssetMintLimit[]>();

          const [guards, setGuards] = useState<GuardReturn[]>([
            { label: "startDefault", allowed: false, maxAmount: 0 },
          ]);
          const [firstRun, setFirstRun] = useState(true);
          const [checkEligibility, setCheckEligibility] = useState<boolean>(true);
          const [isMinting, setIsMinting] = useState(false);
          const router = useRouter();
          const wallet = useWallet();
          const umiWithWallet = useMemo(() => wallet.connected ? umi.use(walletAdapterIdentity(wallet)) : umi, [umi, wallet]);
          const walletBalance = useWalletBalance(umiWithWallet);

          const candyMachineId: PublicKey = useMemo(() => {
            if (process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
              return publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID);
            } else {
              console.error(`NO CANDY MACHINE IN .env FILE DEFINED!`);
              toast({
                id: 'no-cm',
                title: 'No candy machine in .env!',
                description: "Add your candy machine address to the .env file!",
                status: 'error',
                duration: 999999,
                isClosable: true,
              })
              return publicKey("11111111111111111111111111111111");
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
          }, []);

          if (!process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
            console.error("No candy machine in .env!")
            if (!toast.isActive('no-cm')) {
              toast({
                id: 'no-cm',
                title: 'No candy machine in .env!',
                description: "Add your candy machine address to the .env file!",
                status: 'error',
                duration: 999999,
                isClosable: true,
              })
            }
          }
          const { candyMachine, setCandyMachine, candyGuard, mintPrice } = useCandyMachine(umi, candyMachineId, checkEligibility, setCheckEligibility, firstRun, setFirstRun);

          useEffect(() => {
            const checkEligibilityFunc = async () => {
              if (!candyMachine || !candyGuard || !checkEligibility || isShowNftOpen) {
                return;
              }
              setFirstRun(false);
              
              const { guardReturn, ownedTokens, ownedCoreAssets } = await guardChecker(
                umi, candyGuard, candyMachine, solanaTime
              );

              setOwnedTokens(ownedTokens);
              setGuards(guardReturn);
              setOwnedCoreAssets(ownedCoreAssets);
              setIsAllowed(false);

              let allowed = false;
              for (const guard of guardReturn) {
                if (guard.allowed) {
                  allowed = true;                   
                  break;
                }
              }

              setIsAllowed(allowed);
              setLoading(false);
            };

            checkEligibilityFunc();
            // On purpose: not check for candyMachine, candyGuard, solanaTime
            // eslint-disable-next-line react-hooks/exhaustive-deps
          }, [umi, checkEligibility, firstRun]);

          const refreshCounters = useCallback(async () => {
            if (candyMachine) {
              try {
                const updatedCandyMachine = await fetchCandyMachine(umi, candyMachine.publicKey);
                setCandyMachine(updatedCandyMachine);
              } catch (error) {
                console.error("Error fetching updated candy machine:", error);
                // Optionally, show an error toast here
              }
            }
            setCheckEligibility(true);
          }, [umi, candyMachine, setCandyMachine, setCheckEligibility]);

          const handleShowNftClose = useCallback(() => {
            onShowNftClose();
            refreshCounters();
          }, [onShowNftClose, refreshCounters]);

          const PageContent = ({ currentImage }) => {
            const availableNFTs = candyMachine ? Number(candyMachine.data.itemsAvailable) - Number(candyMachine.itemsRedeemed) : 0;
            const totalNFTs = candyMachine ? Number(candyMachine.data.itemsAvailable) : 0;
            const progress = totalNFTs > 0 ? ((totalNFTs - availableNFTs) / totalNFTs) * 100 : 0;
            const progressColor = availableNFTs === 0 ? "red" : "green"; // Set color based on available NFTs
            const counterBgColor = availableNFTs === 0 ? "red.500" : "green.500"; // Set counter background color based on available NFTs
            const mintButtonColor = availableNFTs === 0 ? "red" : "green"; // Set mint button color based on available NFTs

            console.log('Wallet balance in PageContent:', walletBalance);

            return (
              <>
                <style jsx global>{`
                  body, html {
                    background: #2d3748;
                    margin: 0;
                    padding: 0;
                    height: 100%;
                    overflow: hidden;
                  }
                  #__next {
                    height: 100%;
                  }
                `}</style>
                <Flex 
                  direction="column"
                  minHeight="100vh" 
                  width="160%" // Increased width
                  alignItems="center"
                  justifyContent="flex-start"
                  paddingTop="5vh"
                >
                  <Box 
                    width="100%" 
                    maxWidth="1000px"
                    mx="auto" 
                    px={4}
                    position="relative"
                    transform="translateX(-19%)" // Move the card slightly to the left
                    borderRadius="20px" // Add this line to round the edges
                    overflow="hidden" // Add this to ensure content doesn't overflow rounded corners
                  >
                    <Box
                      position="absolute"
                      top="0"
                      left="0"
                      right="0"
                      bottom="0"
                      bg="black"
                      opacity="0.3"
                      borderRadius="20px" // Match the outer Box's borderRadius
                    />
                    <Card width="100%" bg="transparent" boxShadow="none">     
                      <CardHeader>
                        <Flex minWidth='max-content' alignItems='center' gap='4' direction="column">
                          <Heading size='lg'>{headerText}</Heading>
                          {loading ? (<></>) : (
                            <>
                              <Box background={counterBgColor} borderRadius={"5px"} p={2} mt={2}>
                                <VStack>
                                  <Text fontSize={"sm"}>Available NFTs: </Text>
                                  <Text fontWeight={"semibold"}>{availableNFTs}/{totalNFTs}</Text>
                                </VStack>
                              </Box>
                              <Progress 
                                value={progress} 
                                size="lg" // Increased size
                                colorScheme={progressColor} // Use the conditional color
                                width="100%" 
                                mt={2} 
                                height="20px" // Increased height
                                borderRadius="10px" // More rounded
                              />
                            </>
                          )}
                        </Flex>
                      </CardHeader>
                          
                      <CardBody>
                        <Center my={4}>
                          <Box
                            rounded={'lg'}
                            pos={'relative'}
                            overflow="hidden"
                            maxWidth="150%"
                            height="auto"
                          >
                            <Image
                              rounded={'lg'}
                              width="100%"
                              height="auto"
                              objectFit={'cover'}
                              alt={"project Image"}
                              src={currentImage}
                              key={currentImage}
                            />
                          </Box>
                        </Center>
                        {wallet.connected && (
                          <Text mt={4} textAlign="center" fontWeight="bold">
                            Wallet Balance: {typeof walletBalance === 'number' && !isNaN(walletBalance) 
                              ? walletBalance.toFixed(2) 
                              : `Loading... (${typeof walletBalance})`} SOL
                          </Text>
                        )}
                        <Stack divider={<StackDivider />} spacing='4'>
                          {loading ? (
                            <VStack spacing={4}>
                              <Skeleton height="30px" width="100%" />
                              <Skeleton height="30px" width="100%" />
                              <Skeleton height="30px" width="100%" />
                            </VStack>
                          ) : (
                            <ButtonList
                              guardList={guards}
                              candyMachine={candyMachine}
                              candyGuard={candyGuard}
                              umi={umi}
                              ownedTokens={ownedTokens}
                              setGuardList={setGuards}
                              mintsCreated={mintsCreated}
                              setMintsCreated={setMintsCreated}
                              onOpen={onShowNftOpen}
                              setCheckEligibility={setCheckEligibility}
                              ownedCoreAssets={ownedCoreAssets}
                              setIsMinting={setIsMinting}
                              mintButtonColor={mintButtonColor} // Pass the mint button color
                            />
                          )}
                        </Stack>
                      </CardBody>
                    </Card>
                  </Box>
                </Flex>
                {wallet.connected && candyMachine && umiWithWallet.identity.publicKey && umiWithWallet.identity.publicKey.toString() === candyMachine.authority.toString() && (
                  <>
                    <Center>
                      <Button backgroundColor={"red.200"} marginTop={"10"} onClick={onInitializerOpen}>Admin Menu</Button>
                    </Center>
                    <Modal isOpen={isInitializerOpen} onClose={onInitializerClose}>
                      <ModalOverlay />
                      <ModalContent maxW="600px"> 
                        <ModalHeader>Initializer</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                          < InitializeModal umi={umiWithWallet} candyMachine={candyMachine} candyGuard={candyGuard} />
                        </ModalBody>
                      </ModalContent>
                    </Modal>
                  
                  </>)
                }

                <Modal isOpen={isShowNftOpen} onClose={handleShowNftClose}>
                  <ModalOverlay />
                  <ModalContent bg="green.500" opacity="1"> {/* Set background to black with reduced opacity */}
                    <ModalHeader color="white">Your minted NFT</ModalHeader> {/* Set text color to white for better contrast */}
                    <ModalCloseButton color="white" /> {/* Set close button color to white for better contrast */}
                    <ModalBody> 
                      <ShowNft nfts={mintsCreated} />
                    </ModalBody>
                  </ModalContent>
                </Modal>
              </>
            );
          };

          return (
            <main style={{ 
              height: '100vh', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'flex-start', 
              paddingTop: '20px' // Adjust this value as needed
            }}>
              <Flex justify="center" align="center" marginBottom="20px"> {/* Adjust this value as needed */}
                <div className={`${styles.wallet} wallet-button`} style={{ whiteSpace: 'nowrap' }}>
                  <WalletMultiButtonDynamic />
                </div>
              </Flex>

              <div className={styles.center}>
                <PageContent 
                  key="content" 
                  currentImage={isMinting ? workimage : image}
                />
              </div>
            </main>
          );
        }
