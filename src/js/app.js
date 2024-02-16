//Author Maryam Taeb
//Part of my dissertation

App = {
    web3Provider: null,
    contracts: {},
    account: '0xeDB69E6eb24e1a9a1877aEEEb821a1770278c777',
  
    init: function() {
      console.log("Initializing app");
      return App.initWeb3();
    },
  
    initWeb3: function() {
        if (typeof window.ethereum !== 'undefined') {
            App.web3Provider = window.ethereum;
            try {
                // Request account access if needed
                window.ethereum.request({ method: 'eth_requestAccounts' });
            } catch (error) {
                // User denied account access
                console.error("User denied account access");
                return;
            }
            web3 = new Web3(window.ethereum);
        } else if (typeof web3 !== 'undefined') {
            // Legacy dapp browsers, using injected web3 instance
            App.web3Provider = web3.currentProvider;
            web3 = new Web3(web3.currentProvider);
        } else {
            // If no injected web3 instance is detected, fallback to Ganache
            App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
            web3 = new Web3(App.web3Provider);
        }
        console.log("Initializing web3");
        return App.initContract();
    },
  
    initContract: function () {
      console.log("Initializing contract");
      return new Promise(function (resolve, reject) {
        $.getJSON("Authenticator.json", function (authenticator) {
          App.contracts.Authenticator = TruffleContract(authenticator);
          App.contracts.Authenticator.setProvider(App.web3Provider);
  
          App.contracts.Authenticator.deployed().then(function (instance) {
            App.instance = instance;
            console.log("Authenticator contract instance available at:", instance.address);
            resolve();
          }).catch(function (error) {
            console.error("Error getting deployed Authenticator instance:", error);
            reject(error);
          });
        });
      });
    },
  
    listenForEvents: function() {
        App.instance.MediaUploaded().watch(function(error, event) {
          if (!error) {
            console.log("Media uploaded event triggered", event.args);
            // Reload or update UI when a new media is uploaded
            App.render();
          } else {
            console.warn("Error listening for media uploaded event", error);
          }
        });
      },      

    readMetadataFromFile: function() {
        const fileInput = document.getElementById('metadataFileInput');
        const file = fileInput.files[0];
    
        return new Promise((resolve, reject) => {
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        const metadata = JSON.parse(event.target.result);
                        resolve(metadata);
                    } catch (error) {
                        console.error('Error parsing metadata:', error);
                        reject(error);
                    }
                };
                reader.readAsText(file);
            } else {
                console.error('No file selected.');
                reject(new Error('No file selected.'));
            }
        });
    },
    compareMetadata: function(metadataFromFile, metadataFromUserFile) {
        // This is a basic example comparing two objects property by property
        return Object.keys(metadataFromFile).every(key => 
          (key !== 'make' && key !== 'model') && metadataFromFile[key] === metadataFromUserFile[key]
        );
    },

    generateAndDownloadReport: function(metadataFromUserFile, metadataFromFile, deepfakeResult, modelAccuracy, fake_news_prediction, fake_news_label, isUploaded, status, ipfsHash, author) {


      let reportText = 'Report Card\n\n';
        reportText += 'Extracted Metadata:\n';
        Object.keys(metadataFromUserFile).forEach(key => {
            reportText += `${key}: ${metadataFromUserFile[key]}\n`;
        });
        reportText += '\nUpload Status:\n';
        if (isUploaded == true){
          reportText += 'File was successfully uploaded.\n';
        }
        else {
          if (status == 1){
            reportText += 'File upload was aborted due to deepfake detection.\n';
   
   
          }
          else{
            reportText += 'File upload was aborted due to Meta data mismatch.\n';
          }
        }
        reportText += '\nMetadata Comparison Result:\n';
        const isMetadataMatch = App.compareMetadata(metadataFromFile, metadataFromUserFile);
        console.log(isMetadataMatch)
        if (isMetadataMatch == true) {
            reportText += '\nAll metadata matches.\n';
        } else {
            reportText += '\nSome metadata did not match:\n';
            console.log(metadataFromFile)
            console.log(metadataFromUserFile)
            Object.keys(metadataFromFile).forEach(key => {
              if (key !== 'make' && key !== 'model') {
                if (metadataFromFile[key] !== metadataFromUserFile[key]) {
                    console.log('expected', metadataFromFile[key])
                    console.log('got', metadataFromUserFile)
                    reportText += `${key}: Expected ${metadataFromFile[key]}, got ${metadataFromUserFile[key]}\n`;
                }
            }
            });
        }
       
        if (ipfsHash != 0){
            reportText += `\nIPFS Hash of the file for retrieval: ${ipfsHash}\n`;
        }
        if (author != 0){
          reportText += `\nWallet ID of the Author who uploaded the Evidence: ${author}\n`;
      }
        reportText += '\nMachine Learning Analysis Result:\n';  
   
   
        if (deepfakeResult[0][1] > deepfakeResult[0][0])  {
            reportText += `\nDeepfake Detection Result: Fake \n`;
            reportText += `DeepFake Detection Model Accuracy: ${modelAccuracy[0][1]}\n`;
        }
        else{
            reportText += `\nDeepfake Detection Result: Real \n`;
            reportText += `DeepFake Detection Model Accuracy: ${modelAccuracy[0][0]}\n`;
   
   
        }
        reportText += `\nFake News Detection Result:  ${fake_news_label}\n`;
        if (fake_news_prediction[0] > fake_news_prediction[1])  {
            reportText += `Fake News Detection Model Accuracy: ${fake_news_prediction[0]}\n`;
        }
        else{
            reportText += `Fake News Detection Model Accuracy: ${fake_news_prediction[1]}\n`;
   
   
        }
   
   
        console.log('Fake News Detection Result:', fake_news_label)
        console.log('Fake News Detection accuracy:', fake_news_prediction[0])
       
        const reportBlob = new Blob([reportText], { type: 'text/plain' });
        const reportUrl = URL.createObjectURL(reportBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = reportUrl;
        downloadLink.download = 'ReportCard.txt';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    },
   
  
    uploadMediaWithMetadata: function() {
      const title = $('#title').val();
      const metadataUrl = `${encodeURIComponent(title)}.json`;
      const walletaddress = App.account;
      // Fetch metadata file from the server
      fetch(metadataUrl)
          .then(response => {
              if (!response.ok) {
                  throw new Error('Network response was not ok');
              }
              return response.json();
          })
          .then(metadataFromFile => {
              const ipfs = IpfsHttpClient.create({
                  host: 'localhost',
                  port: 5001,
                  protocol: 'http'
              });
               const fileInput = document.getElementById('fileInput');
              const selectedFile = fileInput.files[0];
              const description = $('#Description').val();
              if (selectedFile) {
                  const reader = new FileReader();
           
                  reader.onload = function(event) {
                      // Construct the FormData object for the file
                      const formData = new FormData();
                      formData.append('file', selectedFile);
                      formData.append('description', description);
                      console.log('Description is', description)
                       // Send the file to the Flask API for deepfake detection
                      fetch('http://127.0.0.1:5000/upload-image', {
                          method: 'POST',
                          body: formData
                      })
                      .then(response => response.json())
                      .then(data => {
                          console.log('Deepfake detection result:', data.predicted_value);
                          console.log('Deepfake detection label:', data.predicted_value[0]);
                          console.log('Deepfake detection accuracy:', data.predicted_value[0][0]);
                          console.log('Fake News detection Probability:', data.fake_news_prediction);
                          console.log('Fake News detection Label:', data.fake_news_label);
                          // Check if the media is detected as fake
                          if (data.predicted_value[0][1] > data.predicted_value[0][0]) {
                 
                              console.error("Media detected as fake, aborting upload...");
                              let metadataFromUserFile;
                              // Extract metadata using exif.js
                              EXIF.getData(selectedFile, function() {
                                  const location = EXIF.getTag(this, 'GPSLongitude') + ', ' + EXIF.getTag(this, 'GPSLatitude');
                                  const timestamp = EXIF.getTag(this, 'DateTime');
                                  const make = EXIF.getTag(this, 'Make');
                                  const model = EXIF.getTag(this, 'Model');
                                  metadataFromUserFile = {
                                      title,
                                      location,
                                      timestamp,
                                      make,
                                      model,
                                  };
                              });
                              setTimeout(() => {
                              App.generateAndDownloadReport(metadataFromUserFile, metadataFromFile, data.predicted_value, data.predicted_value, data.fake_news_prediction, data.fake_news_label, false, 1, 0, walletaddress);}, 0);
                              return; // Stop execution if media is fake
                          }
                           console.log("Media is real, proceeding to upload...");
                          // Rest of the code for uploading to IPFS and smart contract goes here
                          ipfs.add(event.target.result).then(result => {
                              const ipfsHash = result.path;
                              console.log('IPFS Hash:', ipfsHash);
                   
                              // Extract metadata using exif.js
                              EXIF.getData(selectedFile, function() {
                                  const location = EXIF.getTag(this, 'GPSLongitude') + ', ' + EXIF.getTag(this, 'GPSLatitude');
                                  const timestamp = EXIF.getTag(this, 'DateTime');
                                  const make = EXIF.getTag(this, 'Make');
                                  const model = EXIF.getTag(this, 'Model');
                                  const metadataFromUserFile = {
                                      title,
                                      location,
                                      timestamp,
                                      make,
                                      model,
                                  };
                                  const isMetadataMatch = App.compareMetadata(metadataFromFile, metadataFromUserFile);
                                  console.log(isMetadataMatch)
                                  if (isMetadataMatch) {
                                      console.log("Metadata matches, proceeding to upload...");
                                  } else {
                                      console.error("Metadata does not match, aborting upload...");
                                      App.generateAndDownloadReport(metadataFromUserFile, metadataFromFile, data.predicted_value, data.predicted_value, data.fake_news_prediction, data.fake_news_label, false, 0, 0, walletaddress);
                                      return; // Stop execution if metadata doesn't match
                                  }      
                                  // Trigger the media upload function with IPFS hash
                                  App.contracts.Authenticator.deployed().then(function(instance) {
                                      const timestamptoupload = Date.parse(timestamp) / 1000;
                                      return instance.uploadMediaWithMetadataToIPFS(title, location, timestamptoupload, make, model, ipfsHash, { from: App.account })
                                     
                                  }).then(function(result) {
                                      // Handle success, update UI, etc.
                                      console.log("Media uploaded successfully:", result);
                                      console.log("Fake news accuracy", data.fake_news_prediction)
                                      App.generateAndDownloadReport(metadataFromUserFile, metadataFromFile, data.predicted_value, data.predicted_value, data.fake_news_prediction, data.fake_news_label, true, '', ipfsHash, walletaddress);
  
  
                                  }).catch(function(error) {
                                    console.log('Deepfake detection result:', data.predicted_value);
                                    console.log('Deepfake detection label:', data.predicted_value[0]);
                                    console.log('Deepfake detection accuracy:', data.predicted_value[0][0]);
                                    console.log('Fake News detection Probability:', data.fake_news_prediction);
                                    console.log('Fake News detection Label:', data.fake_news_label);
                                      // Handle error, show user-friendly message, etc.
                                      console.error("Error uploading media:", error);
                                  });
  
  
                              });
                             
                          });
                      })
                      .catch(error => {
                          console.error('Error in deepfake detection:', error);
                      });
                  };
           
                  // Read the selected file as an ArrayBuffer
                  reader.readAsArrayBuffer(selectedFile);
              } else {
                  console.error('No file selected.');
              }
          })
          .catch(error => {
              console.error('Error fetching metadata:', error);
          });


      // Call render after uploading media
      App.render();
    },
    
  
    render: function () {
        App.contracts.Authenticator.deployed().then(function (instance) {
          // Display the media upload form
          $('#loader').hide();
          $('#content').show();
      
          // Fetch and display uploaded media with metadata
          return instance.mediaCount();
        }).then(async function (mediaCount) {
          const mediaContainer = $('#mediaContainer');
          mediaContainer.empty(); // Clear existing content
          mediaContainer.html('')
      
          for (let i = 1; i <= mediaCount; i++) {
            try {
            mediaContainer.empty(); // Clear existing content
            mediaContainer.html('')
              const instance = await App.contracts.Authenticator.deployed();
      
              const mediaInfo = await instance.media(i);
              const media = {
                id: mediaInfo[0].toNumber(),
                hash: mediaInfo[1],
                title: mediaInfo[2],
                author: mediaInfo[3],
                location: mediaInfo[4],
                timestamp: mediaInfo[5].toNumber(),
                make: mediaInfo[6],
                model: mediaInfo[7],
              };
      
            } catch (error) {
              console.error("Error fetching media details:", error);
            }
          }

        }).catch(function (error) {
          console.error("Error rendering media:", error);
        });
      },
      
  };
  
  $(function() {
    $(window).on('load', function() {
      App.init().then(function() {
        $('#loader').hide();
        $('#content').show();
        App.listenForEvents();
        App.render();
      }).catch(function(error) {
        console.error("Error initializing app:", error);
      });
    });
  });
  