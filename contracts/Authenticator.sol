pragma solidity ^0.5.0;

contract Authenticator {
  uint public mediaCount = 0;
  string public name = "Authenticator";
  mapping(uint => Media) public media;

  struct Media {
    uint id;
    string hash;
    string title;
    address author;
    string location;
    uint timestamp;
    string make;
    string model;
  }

  event MediaUploaded(
    uint id,
    string hash,
    string title,
    address author,
    string location,
    uint timestamp,
    string make,
    string model
  );

  constructor() public {
  }

function uploadMediaWithMetadataToIPFS(
    string memory _title,
    string memory _location,
    uint _timestamp,
    string memory _make,
    string memory _model,
    string memory _ipfsHash
  ) public {
    // Increment media id
    mediaCount++;

    // Add media to the contract
    media[mediaCount] = Media(
      mediaCount,
      _ipfsHash, // Use IPFS hash instead of a direct hash
      _title,
      msg.sender,
      _location,
      _timestamp,
      _make,
      _model
    );

    // Trigger an event
    emit MediaUploaded(
      mediaCount,
      _ipfsHash,
      _title,
      msg.sender,
      _location,
      _timestamp,
      _make,
      _model
    );
  }
}
