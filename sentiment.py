from transformers import BlipProcessor, BlipForImageCaptioning
import torch


# inputs = processor(image, return_tensors="pt")


# out = model.generate(**inputs)
# caption = processor.decode(out[0], skip_special_tokens=True)

# print("Caption:", caption)

def get_preprocess_and_model():
    processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
    model = BlipForImageCaptioning.from_pretrained("Salesforce/blip-image-captioning-base")
    return (processor, model) 