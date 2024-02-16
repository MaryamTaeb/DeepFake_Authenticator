# Author Maryam Taeb
# Part of my dissertation
# This is the Flask App that allows for the truffle Dapp to communicate with the pretrained machine learning models that perform deepfake and fakenews detections
import re
import cv2
import numpy as np
import tensorflow as tf
from nltk.stem import PorterStemmer
from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
from tensorflow.keras.models import load_model
from transformers import BertTokenizer, TFBertForSequenceClassification

app = Flask(__name__)
cors = CORS(app, resources={r"/upload-image": {"origins": "*"}})
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['CORS_LOGGING'] = True

@app.route('/upload-image', methods=['POST', 'OPTIONS'])

def upload_image():

    # Error Handling (With File uPLOAD)
    if 'file' not in request.files: 
        return jsonify({'error': 'No file uploaded'}), 400
    
    # Defining File and Evidence Description
    file = request.files['file']
    description = request.form['description']
    
    # Load the saved model
    DeepFake_efficientnet = load_model('/Users/maryam/Dissertation_Dapp/src/js/Pretrained Models/BaseEffecienNetB2ForEFFandRes.h5')
    FakeNews_Bert = TFBertForSequenceClassification.from_pretrained('/Users/maryam/Dissertation_Dapp/src/js/Pretrained Models/bert_model')
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
    #print("Preprocessed Text is:", preprocessed_text)

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        # Process the file and perform predictions 
        file_bytes = file.read()
        # Convert the bytes to a numpy array and prepare for deepfake detection
        np_arr = np.frombuffer(file_bytes, np.uint8)
        # Decode the numpy array into an image
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        resized_image = cv2.resize(img, (225, 225))
        image_reshaped = np.reshape(resized_image, (1, 225, 225, 3))
        # Make Deepfake detection predictions
        predicted_value = DeepFake_efficientnet.predict(image_reshaped)

        # Begining of Fake News detection
        # Tokenize the preprocessed text
        inputs = tokenizer(preprocessed_text, truncation=True, padding='max_length', max_length=42, return_tensors='tf')
        # Extract input tensors
        token_tensors = inputs['input_ids']
        segment_tensors = inputs['token_type_ids']
        mask_tensors = inputs['attention_mask']
        # Make FakeNews detection predictions
        predictions = FakeNews_Bert.predict([token_tensors, segment_tensors, mask_tensors])
        logits = predictions.logits[0] 
        probabilities = tf.nn.softmax(logits)
        # Define a mapping from your numeric labels to descriptive strings
        label_map = {0: "Fake", 1: "Real"}
        # Use tf.argmax to get the predicted label as before
        predicted_label_numeric = tf.argmax(probabilities).numpy()
        # Map the numeric label to a descriptive string
        predicted_label = label_map[predicted_label_numeric]
        probabilities_list = probabilities.numpy().tolist()
        print("fake news probability list", probabilities_list)


        # Return the prediction result
        return jsonify({
            'fake_news_prediction': probabilities_list,
            'fake_news_label': predicted_label,
            'predicted_value': predicted_value.tolist()}), 200

if __name__ == '__main__':
    app.run(debug=True)