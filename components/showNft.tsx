import { JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { PublicKey } from "@metaplex-foundation/umi";
import { Box, Text, Divider, SimpleGrid, VStack, Button } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from "@chakra-ui/react";

// Assuming umi is imported or defined somewhere in the component
import { fetchCandyMachine, safeFetchCandyGuard, guardChecker } from "../utils/api"; // Adjust the import path as necessary
import { useToast } from "@chakra-ui/react"; // Assuming toast is from Chakra UI

interface TraitProps {
  heading: string;
  description: string;
}

interface TraitsProps {
  metadata: JsonMetadata;
}

const Trait = ({ heading, description }: TraitProps) => {
  return (
    <Box
      backgroundColor={"#333333"}
      borderRadius={"5px"}
      width={"120px"}
      minHeight={"50px"}
    >
      <VStack>
        <Text fontSize={"sm"} fontWeight={"semibold"}>
          {heading}
        </Text>
        <Text fontSize={"sm"} marginTop={"-2"}>
          {description}
        </Text>
      </VStack>
    </Box>
  );
};

const Traits = ({ metadata }: TraitsProps) => {
  if (metadata === undefined || metadata.attributes === undefined) {
    return <></>;
  }

  //find all attributes with trait_type and value
  const traits = metadata.attributes.filter(
    (a) => a.trait_type !== undefined && a.value !== undefined
  );
  const traitList = traits.map((t) => (
    <Trait
      key={t.trait_type}
      heading={t.trait_type ?? ""}
      description={t.value ?? ""}
    />
  ));

  return (
    <>
      <Divider marginTop={"15px"} />
      <SimpleGrid marginTop={"15px"} columns={3} spacing={5}>
        {traitList}
      </SimpleGrid>
    </>
  );
};

const shareOnTwitter = (metadata: JsonMetadata) => {
  const text = `Check out this NFT I just minted! Great piece of art from Bohemia ArtFair: ${metadata.name}`;
  const imageUrl = metadata.animation_url ?? metadata.image;

  if (!imageUrl) {
    console.error("Image URL is undefined");
    return;
  }

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(imageUrl)}`;

  window.open(tweetUrl, '_blank');
};

function Card({        
  metadata,
}: {
  metadata: JsonMetadata | undefined;
}) {
  // Get the images from the metadata if animation_url is present use this
  if (!metadata) {
    return <></>;
  }
  const image = metadata.animation_url ?? metadata.image;
  return (
    <Box position={"relative"} width={"full"} overflow={"hidden"}>
      <Box
        key={image}
        height={"sm"}
        position="relative"
        backgroundPosition="center"   
        backgroundRepeat="no-repeat"
        backgroundSize="cover"
        backgroundImage={`url(${image})`}
      />
      <Text fontWeight={"semibold"} marginTop={"15px"}>
        {metadata.name}
      </Text>
      <Text>{metadata.description}</Text>
      <Button
        colorScheme="twitter"
        onClick={() => metadata && shareOnTwitter(metadata)}
        marginTop={"10px"}
      >
        Share on Twitter
      </Button>
      <Traits metadata={metadata} />
    </Box>
  );
}

type Props = {
  nfts:
    | { mint: PublicKey; offChainMetadata: JsonMetadata | undefined }[]
    | undefined;
};

export const ShowNft = ({ nfts }: Props) => {
  if (nfts === undefined) {
    return <></>;
  }

  const cards = nfts.map((nft, index) => (
    <AccordionItem key={nft.mint + "Accordion"}>
      <h2>
        <AccordionButton>
          <Box as="span" flex="1" textAlign="left">
            {nft.offChainMetadata?.name}
          </Box>
          <AccordionIcon />
        </AccordionButton>
      </h2>
      <AccordionPanel pb={4}>
        <Card metadata={nft.offChainMetadata} key={nft.mint} />
      </AccordionPanel>
    </AccordionItem>
  ));
  return (
    <Accordion defaultIndex={[0]} allowMultiple={true} >
      {cards}
    </Accordion>
  );
};

// Add the necessary useEffect hooks with updated dependencies
const ShowNftComponent = ({ umi, checkEligibility, candyMachineId, firstRun, setfirstRun, toast }) => {
  const [candyMachine, setCandyMachine] = useState(null);
  const [candyGuard, setCandyGuard] = useState(null);
  const [isAllowed, setIsAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ownedTokens, setOwnedTokens] = useState([]);
  const [guards, setGuards] = useState([]);
  const [ownedCoreAssets, setOwnedCoreAssets] = useState([]);
  const [isShowNftOpen, setIsShowNftOpen] = useState(false);

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
          candyMachine = await fetchCandyMachine(umi, PublicKey(candyMachineId));
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

        if (firstRun){
          setfirstRun(false)
        }
      }
    })();
  }, [umi, checkEligibility, candyMachineId, firstRun, setfirstRun, toast]);

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

  useEffect(() => {
    console.log('Wallet connected:', wallet.connected);
    console.log('Wallet balance in PageContent:', walletBalance);
  }, []);

  return (
    <div>
      {/* Your component JSX here */}
      <ShowNft nfts={ownedTokens} />
    </div>
  );
};

export default ShowNftComponent;
