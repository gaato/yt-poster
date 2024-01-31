import io
import logging
from typing import Optional

import requests
import tweepy


class TwitterPoster:
    def __init__(
        self,
        consumer_key: str,
        consumer_secret: str,
        access_token: str,
        access_token_secret: str,
    ) -> None:
        """
        Initializes the TwitterPoster.

        Args:
            consumer_key: The consumer key for the Twitter API.
            consumer_secret: The consumer secret for the Twitter API.
            access_token: The access token for the Twitter API.
            access_token_secret: The access token secret for the Twitter API.
        """
        try:
            self.auth = tweepy.OAuthHandler(consumer_key, consumer_secret)
            self.auth.set_access_token(access_token, access_token_secret)
            self.api = tweepy.API(self.auth)
            self.client = tweepy.Client(
                consumer_key=consumer_key,
                consumer_secret=consumer_secret,
                access_token=access_token,
                access_token_secret=access_token_secret,
            )
        except Exception as e:
            logging.error(e)
            raise e

    def media_upload(self, url: str) -> str:
        with requests.get(url) as r:
            if r.status_code != 200:
                logging.error(f"Failed to download {url}")
                return None
            file = io.BytesIO(r.content)
            filename = url.split("/")[-1]

        return self.api.media_upload(file=file, filename=filename).media_id

    def post_tweet(
        self,
        text: str,
        media_ids: list[str] = [],
        reply_to: str | int = None,
    ) -> Optional[tweepy.Response]:
        """
        Posts a tweet with specified text and media IDs.

        Args:
            text: The text of the tweet.
            media_ids: List of media IDs to attach to the tweet.
            reply_to: The ID of the tweet to reply to.

        Returns:
            True if the tweet was posted successfully, False otherwise.
        """
        try:
            result = self.client.create_tweet(
                text=text, media_ids=media_ids, in_reply_to_tweet_id=reply_to
            )
        except Exception as e:
            logging.error(e)
            return None
        else:
            logging.info(f"Tweeted: {text}")
            return result
