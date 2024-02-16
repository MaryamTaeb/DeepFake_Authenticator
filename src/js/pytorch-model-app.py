# Author Maryam Taeb
# Part of my dissertation
# This is the Flask App that allows for the truffle Dapp to communicate with the pretrained machine learning models that perform deepfake and fakenews detections
# This App.py is for those who would like to run the pytorch deepfake detection model
# Currently, the tensorflow implementation gives better accuracy
import sys
import re
import torch
import torch.nn as nn
from PIL import Image
import tensorflow as tf
import torch.nn.functional as F
from torchvision import transforms
from nltk.stem import PorterStemmer
from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
from efficientnet_pytorch import EfficientNet
sys.path.append('/opt/homebrew/lib/python3.11/site-packages')
from transformers import BertTokenizer, TFBertForSequenceClassification

app = Flask(__name__)

cors = CORS(app, resources={r"/upload-image": {"origins": "*"}})
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['CORS_LOGGING'] = True

@app.route('/upload-image', methods=['POST', 'OPTIONS'])

def upload_image():

    # Initialize EfficientNet model for deepfake detection from the pretrained pytorch model
    efficientnet_model = EfficientNet.from_pretrained('efficientnet-b3')
    num_classes = 2
    in_features = efficientnet_model._fc.in_features
    efficientnet_model._fc = nn.Linear(in_features, num_classes)
    efficientnet_model.load_state_dict(torch.load("EfficientNetModel.pth", map_location=torch.device('cpu')))
    efficientnet_model.eval()

    if 'file' not in request.files: 
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    description = request.form['description']
    # Load the saved model for fakenews detection 
    model = TFBertForSequenceClassification.from_pretrained('bert_model')

    # Preprosessing evidence description

    # Removing suffixes from words
    stemmer = PorterStemmer()
    # Initialize the tokenizer
    tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')
    # Replace characters that are not between a to z or A to Z with whitespace
    text = re.sub('[^a-zA-Z]', ' ', description)
    # Convert all characters into lowercase
    text = text.lower()
    # Remove inflectional morphemes like "ed", "est", "s", and "ing" from their token stem
    text = [stemmer.stem(word) for word in text.split()]
    # Join the processed words back into a single string
    preprocessed_text = ' '.join(text)
    # Preprocess the input text
    #print("Preprocessed Text:", preprocessed_text)

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:

        # Open the input image in RGB format for pytorch model to process
        img = Image.open(file.stream).convert('RGB')
        # Process the file and perform predictions 
        preprocess = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        img_tensor = preprocess(img).unsqueeze(0)
        class_labels = {0: "fake", 1: "real"}
        # EfficientNet Deepfake Prediction
        logits_efficientnet = efficientnet_model(img_tensor)
        probabilities_efficientnet = F.softmax(logits_efficientnet, dim=1)
        predicted_class_efficientnet = torch.argmax(probabilities_efficientnet, dim=1).item()
        confidence_efficientnet = probabilities_efficientnet[0][predicted_class_efficientnet].item() * 100
        predicted_label_efficientnet = class_labels[predicted_class_efficientnet]
        #print('confidence_efficientnet', confidence_efficientnet)
        #print('predicted_label_efficientnet', predicted_label_efficientnet)
        result = f"EfficientNet: {predicted_label_efficientnet} ({confidence_efficientnet:.2f}% confidence)\n"

        # Begining of Fake News detection
        
        # Tokenize the preprocessed text
        inputs = tokenizer(preprocessed_text, truncation=True, padding='max_length', max_length=42, return_tensors='tf')
        # Extract input tensors
        token_tensors = inputs['input_ids']
        segment_tensors = inputs['token_type_ids']
        mask_tensors = inputs['attention_mask']

        # Make FakeNews predictions
        predictions = model.predict([token_tensors, segment_tensors, mask_tensors])
        logits = predictions.logits[0]
        probabilities = tf.nn.softmax(logits)
        predicted_label = tf.argmax(probabilities)
        probabilities_list = probabilities.numpy().tolist()

        # Print the predicted label and probabilities
        # if predicted_label == 0:
        #     print("\n*-*-Fake News-*-*")
        # else:
        #     print("\n*-*-Real News-*-*"
        # print("\nProbability of being fake: {:.2%}".format(probabilities[0]))
        # print("Probability of being real: {:.2%}".format(probabilities[1]))

        # Return the prediction result
        return jsonify({
            'fake_news_prediction': probabilities_list[0],
            'predicted_value': result}), 200

if __name__ == '__main__':
    app.run(debug=True)